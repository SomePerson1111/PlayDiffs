
class MathLiveFormula{
    constructor(parent,text = "",equation_list = []){
        this.type = "math";
        this.math_input = new MathfieldElement();
        
        //this.math_input.setAttribute("math-virtual-keyboard-policy","auto");
        //this.math_input.id = "math_field_input"+equation_list.length;
        //this.math_input.set
        this.math_input.style.flex= '1';
        this.math_input.style.fontSize = "18px";
        if(equation_list != null){
            equation_list.push(this);
            this.list_pointer = equation_list;
        }
        this.math_input.textContent = text;

        parent.appendChild(this.math_input);
        
        /*remove Im inline*/
        //const newShortcuts = Object.assign({}, this.math_input.inlineShortcuts);
        //newShortcuts.Im = "";
        //this.math_input.inlineShortcuts = newShortcuts;
        ////////////////
        
    }
    remove_list(){
        let arr = this.list_pointer 
        arr.splice(arr.indexOf(this),1);
    }
    updateShortcuts(){
        const newShortcuts = Object.assign({}, this.math_input.inlineShortcuts);
        newShortcuts.Im = "";
        this.math_input.inlineShortcuts = newShortcuts;
    }

};
class LatexComment{
    constructor(parent,text = "input you text",equation_list = []){
        this.type = "latex";
        this.saved_text = text;
        this.is_edditing = false
        this.latex_input = document.createElement("div");
        
        this.latex_input.style.fontSize = "18px"
        this.latex_input.style.flex= '1';
        this.latex_input.style.backgroundColor = "white";
        this.latex_input.style.border = "2px solid grey";
        this.latex_input.style.minWidth = "10px";
        this.latex_input.style.padding= "10px";

        this.latex_input.textContent = text;
        this.latex_input.setAttribute("contenteditable","true");

        this.latex_input.addEventListener("focusin",()=>{this.focus_in()});
        this.latex_input.addEventListener("focusout",()=>{this.focus_out()});

        parent.appendChild(this.latex_input);
        this.list_pointer = equation_list;
    }
    focus_in() {
        if(this.is_edditing == false){
            this.latex_input.textContent = this.saved_text;
            this.is_edditing = true;
        }
        
    }
    focus_out() {
        if(this.is_edditing == true){
            this.saved_text = this.latex_input.textContent;
            this.is_edditing = false;
            MathJax.typesetPromise([this.latex_input]).then(() => {
                //console.log("Рендеринг завершен.");
            }).catch((err) => {
                console.warn("Ошибка рендеринга MathJax: ", err);
            });
        }
    }
};
/// class, representing formula area and buttons
class FormulaGroup {
    constructor(container,text,text_type,equation_list = []) {
        /*parent container, where we put area*/
        this.container = container;
        /*initial text*/
        this.text = text;

        /* create li container, where we put all*/
        this.group = document.createElement("li");

        this.group.className = "group";
        this.group.setAttribute("draggable",true);
        container.appendChild(this.group);

        /* input formula field */
        this.input = (
            text_type == "math" ?
            new MathLiveFormula(this.group,text,equation_list):
            new LatexComment(this.group,text,equation_list)
        );
        /* input formula field */

        /* delete button */
        let deleteButton = document.createElement("button");
        deleteButton.textContent = "del";
        this.group.appendChild(deleteButton);

        /* create new formula button */
        let addBelowFButton = document.createElement("button");
        addBelowFButton.textContent = "F+";
        this.group.appendChild(addBelowFButton);
        
        /* create new text button */
        let addBelowTButton = document.createElement("button");
        addBelowTButton.textContent = "T+";
        this.group.appendChild(addBelowTButton);

        /* up button */
        let moveUpButton = document.createElement("button");
        moveUpButton.textContent = "Up";
        this.group.appendChild(moveUpButton);

        /* down button */
        let moveDownButton = document.createElement("button");
        moveDownButton.textContent = "Dn";
        this.group.appendChild(moveDownButton);

        this.container.appendChild(this.group);
        //this.container.appendChild();

        // delete functoin callback to button delete
        deleteButton.addEventListener("click", () => {
            this.delete();
        });

        // add below F functoin callback to button F+
        addBelowFButton.addEventListener("click", () => {
            this.addBelow("math");
        });
        
        // add below T functoin callback to button T+
        addBelowTButton.addEventListener("click", () => {
            this.addBelow("latex");
        });
        
        // move up functoin callback to button up
        moveUpButton.addEventListener("click", () => {
            this.moveUp();
        });

        // move down functoin callback to button down
        moveDownButton.addEventListener("click", () => {
            this.moveDown();
        });

        ///remove Im substitution in math field
        if( text_type == "math" ){
            this.input.updateShortcuts();
        }
    }

    /// delete item element
    delete() {
        let item = this.group
        //remove only if element is not along. check
        if(item.nextElementSibling != null || item.previousElementSibling != null){
            if(this.input.type == "math"){
                this.input.remove_list();
            }
            this.group.remove();
        }
    }

    /// sdd new item element below this
    addBelow(text_type) {
        //const newGroupText = `hello ${this.container.children.length + 1}`;
        let new_next = new FormulaGroup(this.container, "",text_type,this.input.list_pointer);
        this.container.insertBefore(new_next.group,this.group);
        this.container.insertBefore(this.group,new_next.group);
    }
    
    /// move item element one position up
    moveUp() {
        let item = this.group;
        let prevItem = item.previousElementSibling;
        if (prevItem) {
            item.parentNode.insertBefore(item, prevItem);
        }
    }

    /// move item element one position down
    moveDown() {
        let item = this.group;
        let nextItem = item.nextElementSibling;
        if (nextItem) {
            item.parentNode.insertBefore(nextItem, item);
        }
    }
}