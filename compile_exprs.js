class CompilationDict{
    constructor(
        diff_dict,
        freevars_dict,
        defines_array,
        step_function
        )
    {
        this.diff_dict = diff_dict;
        //diff_dict [{varname:"", varname_latex:"",rvalue:...}]
        this.freevars_dict = freevars_dict;
        //freevars_dict [{varname:"", varname_latex}]
        this.defines = defines_array;
        //defines [{varname:"", varname_latex:"",rvalue:...}]
        this.step_function = step_function;
        //step_function array [()=>{},()=>{},...]
    }
    get constnum(){
        return this.freevars_dict.length;
    }
    get varnum(){
        return this.diff_dict.length;
    }
};
class RecursionError extends Error{
    constructor(VarDefines_array,index){
        
        let message = 
        (index >= 0) ? (
            "Expression \"" + 
            String(VarDefines_array[index].rvalue) + 
            "\", defines variable " +VarDefines_array[index].varname  + 
            ", but refers to self varname"
        ) : (
            "trying to parse expression"+ 
            " found complex recursion"
        );
        super(message);
        this.name = 'RecursionError';
        this.defines = VarDefines_array;
        this.index = index;
    }
}
class CompilationError extends Error{
    constructor(InlinedDiffExpressions,index,out_error){
        
        let message = 
            "trying to compile diff equation  \"" + 
            String(InlinedDiffExpressions[index].rvalue) + 
            "\", wich evolute variable " + InlinedDiffExpressions[index].varname  + 
            ", but got compile error";
        
        super(message);
        this.name = 'CompilationError';
        this.defines = InlinedDiffExpressions;
        this.index = index;
        this.stack = out_error.stack; 
    }
}


function compile_exprs(
    pars_eng,
    DiffExprs = [],VarDefines = [],DefaultDefines =[],
    logging = false
    ){
    // первое, что нужно сделать - построить дерево зависимостей,
    // и если есть рекурсия, то ошибка
    
    const mlog = (str)=>{if(logging){console.log(str);}};

    const DiffVarNames = ['t'];
    for(let i=0;i<DiffExprs.length;++i){
        DiffVarNames.push(DiffExprs[i].varname);
    }
    const VarDefNames = []
    for(let i=0;i<VarDefines.length;++i){
        VarDefNames.push(VarDefines[i].varname);
    }

    let VarDefines_Deps = [];
    let DiffExprs_Deps = [];

    let free_vars_names = [];
    
    for(let i=0;i<VarDefines.length;++i){
        let m_deps_strs = [];
        let potent_deps = get_variables_strs(VarDefines[i].rvalue);
        for(let j = 0; j<potent_deps.length;++j){
            if(!DiffVarNames.includes(potent_deps[j]) && 
               !DefaultDefines.includes(potent_deps[j])
            ){
                m_deps_strs.push(potent_deps[j]);
            }
        }
        for(let k=0;k<m_deps_strs.length;++k){
            if(
                !VarDefNames.includes(m_deps_strs[k]) && 
                !free_vars_names.includes(m_deps_strs[k]) 
            ){
                free_vars_names.push(m_deps_strs[k]);
            }
        }
         
        let m_deps = [];
        for(let j=0;j<VarDefines.length;++j){
            if(m_deps_strs.includes(VarDefines[j].varname)){
                if(i == j){
                    throw new RecursionError(VarDefines,j);
                }
                m_deps.push(j);
            }
        }
        VarDefines_Deps.push(m_deps);
    }
    for(let i=0;i<DiffExprs.length;++i){
        let m_deps_strs = [];
        let potent_deps = get_variables_strs(DiffExprs[i].rvalue);
        for(let j = 0; j<potent_deps.length;++j){
            if(!DiffVarNames.includes(potent_deps[j]) && 
               !DefaultDefines.includes(potent_deps[j])
            ){
                m_deps_strs.push(potent_deps[j]);
            }
        }
        for(let k=0;k<m_deps_strs.length;++k){
            if(
                !VarDefNames.includes(m_deps_strs[k]) && 
                !free_vars_names.includes(m_deps_strs[k]) 
            ){
                free_vars_names.push(m_deps_strs[k]);
            }
        }
        let m_deps = [];
        for(let j=0;j<VarDefines.length;++j){
            if(potent_deps.includes(VarDefines[j].varname)){
                m_deps.push(j);
            }
        }
        DiffExprs_Deps.push(m_deps);
    }
    mlog(`free var names: ${free_vars_names}`);

    mlog(`dependensis in vars: ${VarDefines_Deps}`);
    
    mlog(`dependensis in diff eqs: ${DiffExprs_Deps}`);

    let VarDeps_levels = Array(VarDefines_Deps.length);
    VarDeps_levels.fill(-1);

    //разрешаем зависимости
    //строим уровни: если нет зависимостей - Уровень 0
    //если есть зависимости уровня i => уровень i+1
    let step_nums_size = 0;
    for(let step_num = 0;step_num < VarDeps_levels.length;++step_num){
        step_nums_size = step_num+1;
        let flag_if_exist = false;
        for(let i = 0;i<VarDefines_Deps.length;++i){
            if(VarDeps_levels[i] < 0 && VarDefines_Deps[i].length == 0){
                VarDeps_levels[i] = step_num;
                flag_if_exist = true;
            }
        }
        if(!flag_if_exist){
            step_nums_size = step_num;
            if(VarDeps_levels.includes(-1)){
                throw new RecursionError(VarDefines,-1);
            } else {
                break;
            }
        }
        for(let i =0;i<VarDeps_levels.length;++i){
            if(VarDeps_levels[i] == -1){
                VarDefines_Deps[i] = 
                    VarDefines_Deps[i].filter(
                        item => VarDeps_levels[item] !== step_num
                    );
            }
        }
    }
    mlog(`Dependency Levels: ${VarDeps_levels}`);

    // Будем инлайнить все лямбды в результирующий массив
    let inlined_defs = [];
    for(let i=0;i<VarDefines.length;++i){
        inlined_defs.push(VarDefines[i].copy());
    }
    //начинаем с уровня 0 до конца
    for(let step_num = 0;step_num<step_nums_size;++step_num){
        for(let i=0;i<VarDeps_levels.length;++i){
            if(VarDeps_levels[i] == step_num){
                inlined_defs[i].rvalue = 
                    prelim_lambda_carry(
                        inline_defines(inlined_defs[i].rvalue,pars_eng,inlined_defs),
                        [],pars_eng
                    );
            }
        }
    }
    mlog(`inlined dependensies: ${inlined_defs}`);
    
    //теперь делаем инлайн подстановки в дифференциальных выражениях
    let inlined_diffs = [];
    for(let i=0;i<DiffExprs.length;++i){
        inlined_diffs.push(DiffExprs[i].copy());
    }
    for(let i=0;i<inlined_diffs.length;++i){
        inlined_diffs[i].rvalue = 
            prelim_lambda_carry(
                inline_defines(inlined_diffs[i].rvalue,pars_eng,inlined_defs),
                [],pars_eng
            );
    }
    mlog(`inlined diff equations: ${inlined_diffs}`);
    
    //следующий этап - определить входные параметры
    //Уже сделано
    //след. этап - скомпилировать выражиние вида (параметры,)
    let arg_array = [];
    let free_vars_dict = [];
    for(let i=0;i<free_vars_names.length;++i){
        arg_array.push(pars_eng.symbol(free_vars_names[i]));
        free_vars_dict.push({
            varname: free_vars_names[i],
            varname_latex : free_vars_names[i]
        });
    }
    for(let i=0;i<DiffVarNames.length;++i){
        arg_array.push(pars_eng.symbol(DiffVarNames[i]));
    }

    let diff_dict = [];
    for(let i = 0;i< inlined_diffs.length;++i){
        try {
            diff_dict.push({
                varname : inlined_diffs[i].varname,
                varname_latex : inlined_diffs[i].varname_latex,
                rvalue : pars_eng.function('Function',[
                    inlined_diffs[i].rvalue,...arg_array])
            });
        } catch (error){
            throw error;
        }
        
    }
    let functions = [];
    for(let i=0;i< diff_dict.length;++i){
        try {
            functions.push(diff_dict[i].rvalue.compile()());
        }catch (error) {
            throw new CompilationError(inlined_diffs,i,error);
        }
    }
    return new CompilationDict(diff_dict,free_vars_dict,inlined_defs,functions);
}

class InputFieldsError extends Error{
    constructor(InputFieldsArray,index,error_ocured){
        message = `InputFieldError at index ${index}`;
        super(message);
        this.name = 'InputFieldError';
        this.inputs = InputFieldsArray;
        this.index = index;
        this.stack = error_ocured.stack; 
    }
}

function CompileImpl(pars_eng,input_expression_array,symbol_defines = [],logging = false){
    const mlog = (str)=>{if(logging){console.log(str)}};

    let VarDefs = [];
    let VarDefsIndexes = [];
    let DiffDefs = [];
    let DiffDefsIndexes = [];

    for(let i=0;i<input_expression_array.length;++i){
        let parsed_expr = null;
        try {
            parsed_expr = latex_parse(input_expression_array[i],pars_eng,logging);
        } catch(err) {
            throw new InputFieldsError(input_expression_array,i,err);
        }
        if(parsed_expr.type === 'var'){
            VarDefs.push(parsed_expr);
            VarDefsIndexes.push(i);
        } else {
            DiffDefs.push(parsed_expr);
            DiffDefsIndexes.push(i);
        }
    }
    let compile_result = null;
    try{
        compile_result = compile_exprs(pars_eng,DiffDefs,VarDefs,symbol_defines,logging);
    } catch (error){
        if(error.name === 'RecursionError'){
            throw new InputFieldsError(
                input_expression_array,VarDefsIndexes[error.index],
                error
            );
        } else if (error.name == 'CompilationError'){
            throw new InputFieldsError(
                input_expression_array,DiffDefsIndexes[error.index],
                error
            );
        }
    }
    return compile_result;
}