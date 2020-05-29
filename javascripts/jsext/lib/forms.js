/*
* Form enhancements and helpers.
*/

var Forms={};


/*
Enhances a form:
	- publishes cancel and submit events on keystrokes (esc, enter)
	- optional validation
	- focuses the first field when show() is called
 
	You can receive events either by passing them in with the constructor:
	 new Forms.EnhancedForm(myForm, {submit:myFunc})
	 or through addEvent
	 myEnhancedForm.addEvent('submit',myfunc)

Options:
	submitOnSuccess: true if you want the form to be submitted if it validates, instead of just firing an event
	validateSubmit: a function that recieves a form and returns true if valid, false if not. It is run in addition
					to the html validation, and can call Form.highlightError(element,message)
*/
Forms.EnhancedForm=new Class({
	initialize:function(form,options){
		this.form=$(form);
		// use the "on[event]=" syntax, instead of addEvent, so we don't double-stack
		// event handlers in case an enhanced form gets called on the same object twice
		this.form.onkeypress = this.keypress.bindAsEventListener(this);
		this.form.onkeyup = this.keyup.bindAsEventListener(this);
		
		this.options=options || {};

		// Add link handlers
		var cancels = $ES('.cancel',form);
		cancels.each(function(e){e.onclick=this.cancel.bindAsEventListener(this);}.bind(this));
		
		var submits = $ES('.submit',form);
		submits.each(function(e){e.onclick=this.submit.bindAsEventListener(this);}.bind(this));
		
		// validate from HTML by default
		this.submitValidators=[Forms.Validation.validateFromHtml];
		if (this.options.validateSubmit)
			this.submitValidators.push(this.options.validateSubmit);
		

		// Might have provided us an event listener for cancel events
		if (this.options.cancel)
			this.addEvent('cancel', this.options.cancel);
		if (this.options.submit)
			this.addEvent('submit', this.options.submit);
			
		// Ensure that no existing error messages in the form flow past
		// the form field they're reporting against
		$ES('.form-error-message',this.form).each(function(e){
			var field = e.getPrevious();
			e.style.width=field.getStyle("width");
		});

		GC.run(function(){this.form=null;}.bind(this));
	},
	/*
	* Toggle this form's visibility
	*/
	toggle:function(){
		if (this.form.style.display=="none")
			this.show();
		else
			this.form.hide();
	},
	show:function(){
		this.form.show();
		this.validateKeypress();
		this.focus();
	},
	focus:function(){
		// Try and focus the first non-disabled form field
		var formTag = $E("form",this.form);
		var f = Forms.util.firstEnabledElement(formTag ? formTag : this.form.getElementsByTagName("input"));
		if (f) f.focus();
	},
	cancel:function(){
		this.fireEvent('cancel');
	},
	keyup:function(ev){
		this.validateKeypress();
	},
	validateKeypress:function(){
		if (this.options.validateKeypress)
		{
			var submitButton = $E('input[type=submit]',this.form);
			submitButton.disabled= !this.options.validateKeypress(this.form);
		}
	},
	validateSubmit:function(){
		// make sure the submit button isn't disabled
		var submitButton = $E('input[type=submit]',this.form);
		if (submitButton.disabled)
			return false;
		
		var isValid=true;
		// make sure to call every single validator, so it can show appropriate errors
		for (var i=0; i<this.submitValidators.length;i++){
			if (!this.submitValidators[i](this.form))
				isValid=false;
		}
		return isValid;
	},
	keypress:function(ev){
		ev=new Event(ev);
		
		// Don't process anything with modifiers
		if (ev.shift || ev.control || ev.alt || ev.meta)
			return;		
		var isTextarea = ev.target.tagName && ev.target.tagName.toLowerCase()=="textarea";
		// If they hit escape, close the dialog
		if (ev.key=="esc"){
			this.cancel();					
		}
		// don't process the enter key on textareas
		else if (ev.key=="enter" && !isTextarea){
			log("submitting form due to enter keypress");
			ev.stop();
			this.submit(ev);
		}
	},
	submit:function(eventArgs){
		// If this dialog validates, submit it
		if (!this.validateSubmit())
			return false;

		this.fireEvent('submit',eventArgs);

		if (this.options.submitOnSuccess){
			var isForm = this.form.tagName.toLowerCase()=="form";		
			var formElement = isForm ? this.form : this.form.getElementsByTagName("form")[0];

			if (formElement)				
				formElement.submit();
		}
		return true;
	}
});
Forms.EnhancedForm.implement(new Events);

/*
 * Various form validation functions
 */
Forms.Validation={
	// true if all fields have a non-whitespace character in them, false otherwise
	noEmptyTextFields:function(form){
		var te=$ES('input[type=text]',form);
		var result=true;
		te.each(function(e){
			if (e.value.trim().length<=0)
				result=false;
		});
		return result;
	},
	/*
	 * Processes validation attributes on HTML elements and shows errors.
	 *
	 * Write html like this:
	 *   <input type="text" name="password" required validate="minLength(5) sameAs(+1)" message="Your passwords should match" />
	 *   <input type="text" name="confirmPassword" />
	 * and the validator will parse those attributes and insert error messages.
	 * Note that a validation requirement of email does not check if it's empty. Add a "required=true" for that.
	 */
	validateFromHtml:function(form){
		var isValid=true;
		
		var fields = form.getElementsByTagName('input');

		// Loop through all form elements and remove previous validation errors		
		for (var i=0;i<fields.length;i++){
			if (fields[i].className.contains('form-error'))
				Forms.Validation.unhighlightError(fields[i]);
		}

		for (var i=0;i<fields.length;i++){
			var e = fields[i];
			// don't validate disabled fields
			if (e.disabled) continue;
			
			var customMessage = e.getAttribute('message');
			var required = e.getAttribute('required');
			
			if (required!=null && required!="false" && e.value.empty()){
				Forms.Validation.highlightError(e,customMessage);
				isValid=false;
				continue;
			}
			
			// skip validation if the field is explicitly not required
			if (required=="false" && e.value.empty()) continue;
			
			var v = e.getAttribute('validate');			
			if (!v) continue;

			v = v.split(' ');
			for (var j=0;j<v.length;j++){
				var r = v[j].trim();
				if (r=="email" && e.value.length>0){
					if (!e.value.match(/.+@.+\..+/))
						Forms.Validation.highlightError(e,"This doesn't look like a valid email address",customMessage);
				}else if (r.startsWith("minLength")){
					var minLength = Forms.Validation.parseValue(r).toInt();
					if (e.value.length<minLength)
						Forms.Validation.highlightError(e,"This should be at least " + minLength + " letters long");
				}else if (r.startsWith("regexp")){
					var regexp = Forms.Validation.parseValue(r);
					regexp = new RegExp(regexp);
					if (!e.value.match(regexp))
						Forms.Validation.highlightError(e,customMessage ? customMessage : "This is invalid");				
				}else if (r.startsWith("sameAs")){
					// parse out the "+1" in sameAs(+1)
					var rel = Forms.Validation.parseValue(r).toInt();
					var sameAs=fields[i+rel];
					// Upon error, highlight the element with the larger index
					if (sameAs.value!=e.value){
						//Forms.Validation.highlightError(i<0 ? e : sameAs,"These should match",customMessage);
						Forms.Validation.highlightError(e,"These should match",customMessage);
					}
				}
				
				// Don't stack errors on top of each other
				if (e.className.contains('form-error')){
					isValid=false;
					break;
				}
			};
		};
		return isValid;
	},
	/* 
	 * parse a value out of an HTML validation requirement, e.g.
	 *   minLength(5)  	=> 5
	 *  regexp($[a-z]*) => $[a-z]*
	 */		
	parseValue:function(str){
		return str.match(/\((.+)\)/)[1];
	},
	unhighlightError:function(element){
		element.removeClass('form-error');
		// Remove the next sibling, which is an error message
		element.parentNode.removeChild(element.getNext());
	},
	highlightError:function(element,defaultMessage, customMessage){
		var message = customMessage || defaultMessage;
		element = $(element);
		element.addClass('form-error');
		var error = new Element(document.createElement("span"));
		error.className="form-error-message";
		error.innerHTML=message;
				
		// Make sure the error message doesn't flow past the width of the form field it's reporting against
		error.style.width=element.getStyle('width');
		
		error.injectAfter(element);
	}
};

Forms.EventHandlers={
	/* Finds the input type="radio" child of the given element, selects it, and focuses it */
	selectRadioChild:function(el){
		var i = $E("input[type=radio]",this);
		i.checked=true;
		i.focus();
	}
};

// Util methods
/*
 * iteratres through all radio buttons in the same group, and finds the one that's checked
 */
Forms.util={
	/*
	 * Given one radio, retrieves all the other in the group
	 */
	radioGroup:function(radio){ return radio.form[radio.name]; },
	selectedRadio:function(radioButton){
		var radios = this.radioGroup(radioButton);
		for (var i=0;i<radios.length;i++)
			if (radios[i].checked)
			return radios[i];
	},
	/*
	 * Selects the first non-disabled radio in the group;
	 * "radio" should be any one of the radio buttons in its group
	 */
	selectFirstActiveRadio:function(radio){
		var radios = this.radioGroup(radio);
		var f = this.firstEnabledElement(this.radioGroup(radio));
		if (f) f.checked=true;
	},
	/*
	 * You can pass in a <form> element, or an array of elements you want to search through
	 */
	firstEnabledElement:function(elements){
		// case where elements=<FORM>
		if (elements.tagName && elements.tagName=="FORM") 
			elements=elements.elements;	
		
		return $A(elements).filter(function(e){return !e.disabled;})[0];
	}
};