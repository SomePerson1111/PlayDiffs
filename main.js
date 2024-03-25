//import "./input_list"

const FormulaArea= document.getElementById('FormulaArea')

var m_equations = [];
var form_group0 = new FormulaGroup(FormulaArea, 
    "Y = K^a \\cdot (L \\cdot E)^{1-a}","math",
    m_equations);
var form_group0 = new FormulaGroup(FormulaArea,
    "$Y$ – ВВП, $K$ – капитал, $L$ – труд","text",
    m_equations);
new FormulaGroup(FormulaArea, 
    "\\cfrac{dK}{dt} = s \\cdot Y - b \\cdot K","math",
    m_equations);
new FormulaGroup(FormulaArea, 
    "\\cfrac{dL}{dt} = n \\cdot L","math",m_equations);
new FormulaGroup(FormulaArea, 
    "\\cfrac{dE}{dt} = g \\cdot E","math",m_equations); 

var pars_engine = new ComputeEngine.ComputeEngine();
var m_latex_dict = ComputeEngine.ComputeEngine.getLatexDictionary(); 
var m_latex_defines = m_latex_dict.filter(
    (item)=>( 
        (item.kind == 'function' || typeof(item.parse)=='function' || 
        typeof(item.serialize)=='function') && (!!item.name) )
).map((item)=>item.name);

var compilated_eqs = null;
var logging_compilation = true;

var SliderGroup_vars = document.getElementById('SliderArea_vars');
var slider_array_vars = [];

var SliderGroup_init = document.getElementById('SliderArea_init');
var slider_array_init = [];

var choose_T = document.getElementById('choose_T');
var choose_tau = document.getElementById('choose_tau');
var choose_dt = document.getElementById('choose_dt');
var plot_area = document.getElementById("GraphArea");


function update_calculations(){
    let T =choose_T.value;
    let tau =choose_tau.value;
    let dt =choose_dt.value;
    if(T <=0 || tau <= 0 || dt <= 0){
        throw new Error("time parametrs should be positive");
    }
    if(tau <= dt || T <= tau){
        throw new Error("time parametrs should be: dt < tau < T");
    }
    const n_skip = Math.ceil(tau/dt);
    const n_steps = Math.ceil(T/tau);
    const dt_effective = T/(n_skip*n_steps);
    const tau_effective = T/(n_steps);
    
    const diff_num = compilated_eqs.varnum;
    const const_num = compilated_eqs.const_num;

    let DynamicArray = new Float64Array(n_steps*(diff_num + 1));
    let Params = slider_array_vars.map( (element)=>Number(element.value) );
    DynamicArray[0] = 0;
    for(let i=0;i<diff_num;++i){
        DynamicArray[1+i] = slider_array_init[i].value;
    }
    const VectorizedStep = (t_and_EvolutedVars)=>{
        return compilated_eqs.step_function.map( (func)=>func(...Params,...t_and_EvolutedVars));
    }
    const fmadd = (array1,array2,mlt)=>{
        for(let i=0;i<array1.length;++i){
            array1[i] += array2[i]*mlt;
        }
    }
    for(let i=1;i<n_steps;++i){
        const Isl_prev =  (i-1)*(diff_num+1);
        const Isl =  Isl_prev + diff_num+1;
        
        m_variables = [...DynamicArray.slice(Isl_prev,Isl)];
        for(let j=0;j<n_skip;++j){
            fmadd(m_variables,[1,...VectorizedStep(m_variables)],dt_effective);
        }
        
        for(let s =0;s<diff_num+1;++s){
            DynamicArray[Isl + s] = m_variables[s];
        }
    }
    //return DynamicArray;
    let t_data = new Array(n_steps);
    let other_data = []
    for(let i=0;i<diff_num;++i){
        other_data[i] = new Array(n_steps);
    }
    for(let j=0;j<n_steps;++j){
        t_data[j] = DynamicArray[j*(diff_num+1)];
        for(let i=0;i<diff_num;++i){
            other_data[i][j] = DynamicArray[j*(diff_num+1) + 1 + i];
        }
    }

    let names = compilated_eqs.diff_dict;
    let traces = [];
    for(let i=0;i<diff_num;++i){
        traces.push({
            x: t_data,
            y: other_data[i],
            type: 'scatter',
            name: names[i].varname
        });
    } 
    Plotly.newPlot(plot_area, traces);
}
choose_T.addEventListener("change",update_calculations);
choose_tau.addEventListener("change",update_calculations);
choose_dt.addEventListener("change",update_calculations);

function Compile(){
    let equation_latex_strings = [];
    for(let i=0;i<m_equations.length;++i){
        equation_latex_strings.push(m_equations[i].math_input.value);
    }
    try{
        compilated_eqs = CompileImpl(
            pars_engine,equation_latex_strings,
            m_latex_defines,logging_compilation
        );
    } catch(error) {
        compilated_eqs = null;
        console.log(error);
    }
    slider_array_vars = [];
    slider_array_init = [];
    clearElement(SliderGroup_vars);
    clearElement(SliderGroup_init);

    if(compilated_eqs){
        for(let i=0;i<compilated_eqs.constnum;++i){
            slider_array_vars.push(
                addRangeContainer(
                    SliderGroup_vars,
                    compilated_eqs.freevars_dict[i].varname,
                    update_calculations
                )
            );
        }
        for(let i=0;i<compilated_eqs.varnum;++i){
            slider_array_init.push(
                addRangeContainer(
                    SliderGroup_init,
                    compilated_eqs.diff_dict[i].varname + "(t=0)",
                    update_calculations
                )
            );
        }
    }
}

const CompileButton = document.getElementById("CompileButton");
CompileButton.addEventListener("click",Compile);

//ce.parse(expr, { canonical: false });
//const expr = "\\frac{30}{-50}";
//ce.parse(expr);
// canonical form ➔ ["Rational", -3, 5]
//
//ce.parse(expr, { canonical: false });
// non-canonical form ➔ ["Divide", 30, -50]


/*var trace1 = {
  x: [1, 2, 3, 4],
  y: [10, 15, 13, 17],
  type: 'scatter'
};

var trace2 = {
  x: [1, 2, 3, 4],
  y: [16, 5, 11, 9],
  type: 'scatter'
};

var data = [trace1, trace2];

Plotly.newPlot('myDiv', data);

var data = [{
    x: ['VALUE 1'], // in reality I have more values... 
    y: [20], 
    type: 'bar'
}]; 
Plotly.newPlot('PlotlyTest', data);
function adjustValue1(value) {
    data[0]['y'][0] = value; 
    Plotly.redraw('PlotlyTest');
}   

*/

