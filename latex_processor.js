function clear_brackets(expr){
    if(expr.head == 'Delimiter'){
        return clear_brackets(expr.ops[0]);
    } else {
        return expr;
    }
}


function concat_subscript(expr){
    if(expr.head == 'Subscript'){
        return String(expr.ops[0].json) + "_" + concat_subscript(expr.ops[1]);
    } else {
        return expr.json;
    }
}
function concat_latex_subscript(expr){
    if(expr.head == 'Subscript'){
        return String(expr.ops[0].json) + "_{" + concat_latex_subscript(expr.ops[1])+"}";
    } else {
        return expr.json;
    }
}

function resolve_transcripts(expr,comp_eng){
    if(expr.head == 'Symbol'){
        return [expr,[{name:String(expr),latex:String(expr)}]];
    }
    else if(
        expr.head == 'Number' || 
        expr.head == 'String'){
        return [expr,[]];
    } else if(expr.head == 'Subscript'){
        let var_name = concat_subscript(expr);
        let var_latex_name = concat_latex_subscript(expr);
        return [comp_eng.symbol(var_name),[{name:var_name,latex:var_latex_name}]];
    } else {
        let m_dict = [];
        for(let i = 0;i<expr.ops.length;++i){
            let [resolved,var_dict] = resolve_transcripts(expr.ops[i],comp_eng);
            expr.ops[i] = resolved;
            for(let j =0;j < var_dict.length;++j){
                if(!m_dict.some((elem)=>{elem.name === var_dict[j].name;})){
                    m_dict.push(var_dict[j]);
                }
            }
        }
        return [expr,m_dict];
    }
}


function check_dt(expr){
    if(concat_subscript(expr) == "dt"){
        return true;
    }
    if(expr.head == 'InvisibleOperator'){
        if(
            concat_subscript(expr.ops[0]) == 'd' &&
            concat_subscript(expr.ops[1]) == 't'  
        ){
            return true;
        }
    }
    return false;
}
function find_d_dt(expr){
    pot_d_dt_op = clear_brackets(expr);
    if(pot_d_dt_op.head != 'Divide'){
        return false;
    }
    if(concat_subscript(clear_brackets(pot_d_dt_op.ops[0])) != "d"){
        return false;
    }
    m_down = clear_brackets(pot_d_dt_op.ops[1]);
    
    return check_dt(m_down);
}
function determine_diff_var_name(expr){
    //check differential equation by prime
    if(expr.head == 'Prime'){
        let potential_var = concat_subscript(clear_brackets(expr.ops[0]));
        let latex_var = concat_latex_subscript(clear_brackets(expr.ops[0]));
        return [true,potential_var,latex_var];
    } else {
        let cleared_expr = clear_brackets(expr);
        //check differential equation in form (d/dt L)
        if(cleared_expr.head == 'Sequence'){
            if(!find_d_dt(cleared_expr.ops[0])){
                return [false,null,null];
            }
            return [true,concat_subscript(clear_brackets(cleared_expr.ops[1]))];
        }
        if(cleared_expr.head == 'InvisibleOperator'){
            if(!find_d_dt(cleared_expr.ops[0])){
                return [false,null,null];
            }
            let potential_var = concat_subscript(clear_brackets(expr.ops[1]));
            let latex_var = concat_latex_subscript(clear_brackets(expr.ops[1]));
            return [true,potential_var,latex_var];
        }
        if(cleared_expr.head == 'Divide'){
            let m_up = clear_brackets(cleared_expr.ops[0]);
            let m_down = clear_brackets(cleared_expr.ops[1]);
            if(!check_dt(m_down)){
                return [false,null,null];
            }
            if(m_up.head == 'InvisibleOperator'){
                let pot_var = concat_subscript(m_up.ops[1]);
                let latex_var = concat_latex_subscript(m_up.ops[1]);
                if(concat_subscript(m_up.ops[0]) == 'd'){
                    return [true,pot_var,latex_var];
                }
            }
        }
    }
    return [false,null,null]; 
}
function resolve_invisible_operator(expr,pars_eng){
    if(expr.head == 'Symbol' || 
        expr.head == 'Number' || 
        expr.head == 'String')
    {
        return expr;
    }
    if(expr.head == 'Delimiter'){
        if(
            expr.ops[0].head == 'Sequence' || 
            expr.ops.length > 1
        ){
            throw new Error("when parsing expression" + expr.toString() + 
            ", it should not be sequence");
        }
        return resolve_invisible_operator(expr.ops[0],pars_eng);
    }
    if(expr.head == 'InvisibleOperator'){
        if(expr.ops[1].head != 'Delimiter'){
            //it is mult, not a function
            let pot_left = expr.ops[0];
            if(pot_left.head == 'Delimiter'){
                if(
                    potential_func.ops[0].head == 'Sequence' || 
                    potential_func.ops.length > 1
                ){
                    throw new Error("when parsing expression" + pot_left.toString() + 
                    ", it should be a function, but got sequence");
                }
                pot_left = pot_left.ops[0];
            }
            return pars_eng.mul(pot_left,expr.ops[1]);
        } else {
            //it is function application
            let potential_func = expr.ops[0];
            let potential_vars = expr.ops[1].ops[0];
            if(potential_func.head == 'Delimiter'){
                if(
                    potential_func.ops[0].head == 'Sequence' || 
                    potential_func.ops.length > 1
                ){
                    throw new Error("when parsing expression" + potential_func.toString() + 
                    ", it should be a function, but got sequence");
                }
                potential_func = potential_func.ops[0];
            }
            if(potential_vars.head != 'Sequence'){
                return  pars_eng.function('Apply',[
                    resolve_invisible_operator(potential_func,pars_eng),
                    resolve_invisible_operator(potential_vars,pars_eng)
                ],{canonical:false});
            } else {
                let new_ops = potential_vars.ops;
                for(let i = 0;i<new_ops.length;++i){
                    new_ops[i] = resolve_invisible_operator(new_ops[i],pars_eng);
                }
                return pars_eng.function('Apply',[
                    resolve_invisible_operator(potential_func,pars_eng),
                    ...new_ops
                ],{canonical:false});
            }
        }

    } else {
        for(let i = 0;i<expr.ops.length;++i){
            expr.ops[i] = resolve_invisible_operator(expr.ops[i],pars_eng);
        }
        return expr;
    }
}


class DXEquation{
    constructor(varname,latex_varname,rvalue_expr,dependences){
        this.rvalue = rvalue_expr;
        this.varname = varname;
        this.varname_latex = latex_varname;
        this.freevars = dependences;
        this.type = 'dif';
    }
    copy(){
        return new DXEquation(this.varname,this.varname_latex,this.rvalue,this.freevars);
    }
    toString(){
        return this.type + ":  Diff(" +
            String(this.varname) + ", t) = " + 
            String(this.rvalue);
    }
};
class VarDef{
    constructor(varname,latex_varcname,rvalue_expr,dependences){
        this.varname = varname;
        this.varname_latex = latex_varcname;
        this.rvalue = rvalue_expr;
        this.freevars = dependences;
        this.type = 'var';
    }
    copy(){
        return new VarDef(this.varname,this.varname_latex,this.rvalue,this.freevars);
    }
    toString(){
        return this.type + ":  " +
            String(this.varname) + " = " + 
            String(this.rvalue);
    }
};
class SimpleEqualDef{
    constructor(lvalue_expr,rvalue_expr,dependences){
        this.lvalue = lvalue_expr;
        this.rvalue = rvalue_expr;
        this.freevars = dependences;
        this.type = 'eq';
    }
    
};

/// renames locals in lambdas, reurn [new_expr,new_subs,new_vars]
function rename_locals(expr,pars_eng,subs = []){
    if(expr.head == 'Number' || 
        expr.head == 'String')
    {
        return expr;
    }
    if(expr.head == 'Symbol'){
        let m_sym_name = String(expr);
        pot_item = subs.find((item)=>{return item.key == m_sym_name;});
        if(pot_item){
            // если элемент есть в заменах => заменяем
            return pot_item.val;
        } else {
            return expr;
        } 
    } else if (expr.head == 'Function'){
        //для функции нужно сделать умную подстановку
        //для встречающихся переменных будем заменять
        //например x -> x__local_123,
        let _local_marker = "__local_";
        let m_local_subs = [];
        let m_local_args = [];
        

        let deprec_symbols = [];
        for(let i = 1;i < expr.ops.length;++i){
            deprec_symbols.push(String(expr.ops[i]));
        }
        for(let j=0;j<subs.length;++j){
            deprec_symbols.push(subs[j].key);
            deprec_symbols.push(String(subs[j].val));
        }

        for(let i=1;i<expr.ops.length;++i){
            let m_var_name  = String(expr.ops[i]);
            let [m_var_pure,m_var_num_str] = m_var_name.split(_local_marker);
            let m_var_prefix = m_var_pure+"__local_";

            let existring_numbers = [];
            for(let j=0;j<deprec_symbols.length;++j){
                if(j!=i-1){
                    op_j_str = deprec_symbols[j];
                    if(op_j_str.startsWith(m_var_prefix)){
                        existring_numbers.push(Number(op_j_str.substr(m_var_prefix.length)));
                    }
                }
            }
            existring_numbers.sort((a,b)=>{return a-b});
            let m_j = 0;
            let sh = 0;
            for(m_j = 0;m_j<existring_numbers.length;++m_j){
                if(existring_numbers[m_j] > m_j - sh){
                    break;
                } else {
                    if(m_j > 0 && existring_numbers[m_j]===existring_numbers[m_j-1]){
                        sh+=1;
                    }
                }
            }
            const newNum = m_j - sh;
            if(!(newNum === Number(m_var_num_str))){
                const new_var_name =m_var_prefix + String(newNum);
                let new_var_symbol = pars_eng.symbol(new_var_name);
                deprec_symbols.push(new_var_name);
                m_local_subs.push({
                    key:m_var_name,
                    val:new_var_symbol
                });
                m_local_args.push(new_var_symbol);
            } else {
                m_local_args.push(expr.ops[i]);
            }
        }
        return pars_eng.function('Function',
            [rename_locals(expr.ops[0],pars_eng,[...m_local_subs,...subs]),...m_local_args]
        );
    } else {
        //в остальных случаях нужно просто сделать необходимые 
        //локальные замены,  при этом список замен
        //точно не будет меняться
        for(let i=0;i<expr.ops.length;++i){
            expr.ops[i] = rename_locals(expr.ops[i],pars_eng,subs);
        }
        return expr;
    }
}

function get_variables_strs(expr){
    if(expr.head == 'Symbol')
    {
        const sym_name = String(expr);
        if(sym_name.includes("__local_")){
            return [];
        } else {
            return [sym_name];
        }
        
    } else if(
        expr.head == 'Number' || 
        expr.head == 'String'
    ){
        return [];
    } else {
        let merged = [];
        for(let i=0;i<expr.ops.length;++i){
            merged = [...new Set([...merged, ...get_variables_strs(expr.ops[i])])];
        }
        return merged;
    }
    return [];
}


function lambda_uncarry(expr,pars_eng){
    if(expr.head == 'Symbol' || 
        expr.head == 'Number' || 
        expr.head == 'String')
    {
        return expr;
    } else if (expr.head == 'Function' && expr.ops[0].head == 'Function'){
        let func_value = lambda_uncarry(expr.ops[0],pars_eng);
        let sub_ops = func_value.ops;
        let m_ops = [sub_ops[0]];
        for(let i=1;i<expr.ops.length;++i){
            m_ops.push(expr.ops[i]);
        }
        for(let i=1;i<sub_ops.length;++i){
            m_ops.push(sub_ops[i]);
        }
        return pars_eng.function('Function',m_ops);
    } else if(expr.head == 'Apply' && expr.ops[0].head == 'Apply'){
        app_value = lambda_uncarry(expr.ops[0],pars_eng);
        let app_ops = app_value.ops;
        let m_ops = [app_ops[0]];
        for(let i=1;i<expr.ops.length;++i){
            m_ops.push(expr.ops[i]);
        }
        for(let i=1;i<app_ops.length;++i){
            m_ops.push(app_ops[i]);
        }
        return pars_eng.function('Apply',m_ops);
    } 
    
    for(let i=0;i<expr.ops.length;++i){
        expr.ops[i] = lambda_uncarry(expr.ops[i],pars_eng);
    }
    return expr;
} 

//subs -- substitution dict of form {key:"",val:}
function prelim_lambda_carry(expr,subs,pars_eng){
    if(expr.head == 'Symbol'){
        pot_item = subs.find((item)=>{return item.key == String(expr);});
        if(pot_item){
            return pot_item.val;
        } else {
            return expr;
        }
    } else if( 
        expr.head == 'Number' || 
        expr.head == 'String')
    {
        return expr;
    }
    else if(expr.head == 'Apply' && expr.ops[0].head == 'Function'){
        m_args = expr.ops;
        m_arg_names = expr.ops[0].ops;
        if(m_args.length > m_arg_names.length){
            throw new Error(
                "try to apply funtion, but got " + 
                "too much argument number, args: |"+
                String(m_args) +"| arg names: " + String(m_arg_names)
            );
        }
        
        new_subs = []
        for(let i = 1;i<m_args.length;++i){
            new_subs.push({
                key:String(m_arg_names[i]),
                val:prelim_lambda_carry(m_args[i],subs,pars_eng)
            });
        }
        if(m_args.length == m_arg_names.length){
            return prelim_lambda_carry(m_arg_names[0],[...subs,...new_subs],pars_eng);
        } else {
            let remain_vars = [];
            for(let i = m_args.length;i<m_arg_names.length;++i){
                remain_vars.push(m_arg_names[i]);
            }
            return pars_eng.function(
                'Function',
                [prelim_lambda_carry(m_arg_names[0],[...subs,...new_subs],pars_eng),...remain_vars]
            );
        }
        
        
    } else {
        for(let i=0;i<expr.ops.length;++i){
            expr.ops[i] = prelim_lambda_carry(expr.ops[i],subs,pars_eng);
        }
        return expr;
    }
}

function latex_parse(latex_string,cp_eng,logging = false){
    mlog = (args)=>{if(logging) console.log(args); };

    mlog(`process string: ${latex_string}`);
    const prelim_replacements = {
        "\\cfrac": "\\frac",
        "->" : " \\mapsto ",
        "\\to" : "\\mapsto",
        "^{\\prime}":"'",
        "\\differentialD":"d ",
        "d_upright":"d ",
        "\\mathrm{d}":"d ",
        "\\,":" ",
        "\\left(":"(",
        "\\right)":")"
    };
    ///Step1: prelim replace unsupported commands by ComputeEngine
    for (const [key, value] of Object.entries(prelim_replacements)) {
        latex_string = latex_string.replaceAll(key, value);
    }
    //TODO найти выражения со скобочками, чтобы
    // z(3)*y не парсилось как z*3*y

    const regex_vars = /(?<!\\)\b[A-Za-z]+\d*(?=_|\b)/g;
    //Step2 replace variables with more than 1 letter but not latex commands
    latex_string = latex_string.replace(regex_vars, function(match) {
        // Если переменная состоит из нескольких букв и не начинается с \, обернем ее в \mathrm{Var}
        if (match.length > 1) {
            if(match[0] == 'd'){
                match1 = match.substr(1);
                if(match1.length > 1){
                    return `d \\mathrm{${match1}}`;
                } else {
                    return `d ${match1}`;
                }
            }
            return `\\mathrm{${match}}`;
        } else {
            return match;
        }
    });
    mlog(`process string after replacements: ${latex_string}`);

    processed_math = cp_eng.parse(latex_string, {canonical: false });

    mlog(`parsed ${String(processed_math)}`);

    if(processed_math.head != 'Equal' && processed_math.head != 'Assign'){
        throw new Error("expression should be assign: 'X = Y', got " + latex_string );
    }
    
    let m_lvalue = processed_math.ops[0];
    let m_rvalue = processed_math.ops[1];

    const [is_diff,def_var,latex_var] = determine_diff_var_name(m_lvalue);
    
    let [m_rvalue_res,rv_deps] = resolve_transcripts(m_rvalue,cp_eng);
    mlog(`m_rvalue(after subscript): ${m_rvalue.toString()}`);
        m_rvalue_apply = resolve_invisible_operator(m_rvalue_res,cp_eng),
            
    mlog(`m_rvalue(after resolve invisible operator): ${m_rvalue_apply.toString()}`);


    if(is_diff){
        let m_rval_locals_rn = rename_locals(m_rvalue_apply,cp_eng);
        let m_runcar = lambda_uncarry(m_rval_locals_rn,cp_eng); 
        let m_rvalue_carr = lambda_uncarry(prelim_lambda_carry(
            m_runcar,
            [],cp_eng
        ),cp_eng);
        Dx = new DXEquation(def_var,latex_var,m_rvalue_carr,rv_deps);
        mlog("maybe successfull diff defenition");
        mlog(String(Dx));
        return Dx;
    } else {
        let [m_lvalue_res,lv_deps] = resolve_transcripts(m_lvalue,cp_eng);
        mlog(`m_lvalue(after subscript): ${m_lvalue_res.toString()}`);
        m_lvalue_apply = resolve_invisible_operator(m_lvalue_res,cp_eng);
        mlog(`m_lvalue(after resolve invisible operator): ${m_lvalue_apply.toString()}`);
        if(m_lvalue_apply.head == 'Apply'){
            if(m_lvalue_apply.ops[0].head == 'Symbol'){
                f_name = String(m_lvalue_apply.ops[0]);
                f_dict_item = lv_deps.find((item)=>{return item.name === f_name;});
                let m_args = [m_rvalue_apply];
                for(let i=1;i<m_lvalue_apply.ops.length;++i){
                    m_args.push(m_lvalue_apply.ops[i]);
                } 
                
                let m_rval_locals_rn = rename_locals(
                    cp_eng.function('Function',m_args),cp_eng
                );
                let m_rvalue_carr = lambda_uncarry(prelim_lambda_carry(
                    lambda_uncarry(m_rval_locals_rn,cp_eng),
                    [],cp_eng
                ),cp_eng);
                
                Fd = new VarDef(f_name,f_dict_item.latex,
                    m_rvalue_carr,
                    rv_deps
                );
                mlog("maybe successfull function defenition");
                mlog(String(Fd));
                return Fd;
            }
            else {
                throw new Error("not supported complex lvalue: " + String(m_lvalue));
            }
        }
        else if (m_lvalue_apply.head == 'Symbol'){
            let v_name = String(m_lvalue_apply);
            let v_dict_item = lv_deps.find((item)=>{return item.name === v_name;});

            let m_rval_locals_rn = rename_locals(m_rvalue_apply,cp_eng);
            let m_runcar = lambda_uncarry(m_rval_locals_rn,cp_eng); 
            let m_rvalue_carr = lambda_uncarry(prelim_lambda_carry(
                m_runcar,
                [],cp_eng
            ),cp_eng);
            
            VarD = new VarDef(v_name,v_dict_item.latex,m_rvalue_carr,rv_deps);

            mlog("maybe successfull var defenition");
            mlog(String(VarD));
            return VarD;
        } else {
            throw new Error("unsupproted type of lvalue: " + String(m_lvalue) + 
            "expext definition aka f(x) = ... or f = ..."+ 
            "or diff !dt! definition aka (df)/(dt), \\cfrac{df}{dt}, f'");
        }
    }
    /// распознавание вызова функций:
    ///"Q(x,y,z)" -> InvisibleOperator(Q, Delimiter(Sequence(x, y, z), "(,)"))
    ///"Q(x)" -> InvisibleOperator(Q, Delimiter(x))
    /// 1) найти зависимые переменные и определить их
    /// 2) (потом) определение зависимых фунций
    /// 3) график + решение
    /// определение функции
    /// Z = pars_engine.function('Function',[pars_engine.parse('f(x)'),pars_engine.parse('x')])
    ///
}

function inline_defines(expr,pars_eng,var_defs){
    if(expr.head == 'Symbol'){
        const m_name = String(expr);
        let m_new_expr = var_defs.find((item)=>{return item.varname === m_name;});
        if(m_new_expr){
            return m_new_expr.rvalue;
        } else {
            return expr;
        }
    } else if( 
        expr.head == 'Number' || 
        expr.head == 'String')
    {
        return expr;
    } else {
        const new_head = expr.head;
        let new_args = [];
        for(let i=0;i<expr.ops.length;++i){
            new_args.push(inline_defines(expr.ops[i],pars_eng,var_defs));
        }
        return pars_eng.function(new_head,new_args,{canonical:false});
    }
}