function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

function addRangeContainer(parent,slider_variable,update_slot) {
    const mainContainer = parent
    // Создаем контейнер для каждой переменной
    const container = document.createElement("div");
    container.className = "container-slider";

    // Название переменной
    const variableName = document.createElement("p");
    variableName.className = "variable-name-slider";
    variableName.textContent = slider_variable;

    //
    const variableValue = document.createElement("input");
    variableValue.type = 'number';
    variableValue.className = "number-edit-slider";
    variableValue.value = 0; 
    
    variableValue.addEventListener("change",(event)=>{
        //console.log("value of slider changes");
        //console.log(`val1: ${variableValue.textContent}, next => ${event}`);
        update_slot();
    });
    // Тут можно динамически устанавливать название
    
    const SliderBox = document.createElement("div");
    SliderBox.className = "slider-box";

    const maxVal= document.createElement("input");
    maxVal.type = 'number';

    maxVal.className = "number-edit-slider";
    maxVal.value = 1; 
    
    
    

    const minVal= document.createElement("input");
    minVal.type = 'number';

    minVal.className = "number-edit-slider";
    minVal.value = -1;
    
    
    // Ползунок
    const slider_wrapper = document.createElement("div");
    slider_wrapper.className = "slider-wrapper-class";
    const slider = document.createElement("input");
    slider.className = "slider-class";
    slider.type = "range";
    slider.min = 0; // Нижний предел ползунка
    slider.max = 200; // Верхний предел ползунка
    slider.value = 100; // Текущее значение
    slider_wrapper.appendChild(slider);
    
    const change_slider = ()=>{
        const m_min = Number(minVal.value);
        const m_max = Number(maxVal.value);
        const m_curr_pers = (Number(slider.value) -slider.min)/(slider.max -slider.min);
        variableValue.value = m_min + (m_max-m_min)*m_curr_pers;
        update_slot();
    };
    maxVal.addEventListener("change",(event)=>{
        change_slider();
    });
    minVal.addEventListener("change",(event)=>{
        change_slider();
    });
    // Вывод текущего значения ползунка
    const sliderValue = document.createElement("span");
    sliderValue.textContent = slider.value;

    slider.oninput = function() {
        change_slider();
    }

    // Добавляем элементы в контейнер
    container.appendChild(variableName);
    SliderBox.appendChild(variableValue);
    SliderBox.appendChild(maxVal);
    SliderBox.appendChild(slider_wrapper);
    SliderBox.appendChild(minVal);
    container.appendChild(SliderBox);
    // Добавляем контейнер в основной контейнер
    mainContainer.appendChild(container);

    return variableValue;
}