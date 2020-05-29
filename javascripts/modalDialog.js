/*
* Shows a modal dialog. 
* 
* You can have many on one page, and each can optionally be modal, but will block out its parent only.
* To shut down the entire page, pass in "document.body" as the parent element. That will force only one visible dialog
* for the whole application.
*
* Tricky bits:
* Set the overflow style to be "auto" after we're done positioning the dialog.
*  This allows input fields in Mozilla to have a caret selection, and to
*  prevent scrollbars on a mac from poking through the dialog. This workaround
*  found in this bug: https://bugzilla.mozilla.org/show_bug.cgi?id=226933
*  slated to be fixed with Firefox 3.
*
* Opacity (used for overlay) should be set using an image on IE6. Using IE's opacity filter consumes
*  lots of memory. http://www.nczonline.net/archive/2007/1/406
*/

ModalDialog = new Class({
	/*
	 * contents should be an existing html element
	 * parent is the element that the dialog will be added to and centered inside of; it should
	 * have its CSS position=relative
	 *
	 * options:
	 *  container: [document.body] a container element, which we use to ensure that the dialog 
	 *    	doesn't appear "out of bounds".
	 *  modal: [true] shows an overlay over its parent. Disables the whole screen if parent == <body>
	 *  width: optional dialog width, e.g. "300px"
	 */
	defaultOptions:{
		cancelButton:true,
		modal:true
	},
	initialize:function(options){
		this.options = $merge(this.defaultOptions,options);
		log(this.options);
		this.wrapper = new Element(ModalDialog.dialogWrapperTemplate.cloneNode(true));
		
		this.dialogBody = $E('.dialog-body',this.wrapper);
		if (options.width)
			this.dialogBody.style.width = this.options.width;
		
		this.dialogBody.innerHTML=this.buildDialogHtml(this.options);
		this.addButtons(this.options, this.options.buttons);
			
		// Add some abilities to the contents of this dialog, 
		// like cancel-on-esc and validation, if it has form contents
		this.form = new Forms.EnhancedForm(this.dialogBody,{
			validateKeypress: options.validateKeypress,
			validateSubmit: options.validateSubmit,
			cancel: this.cancel.bindAsEventListener(this),
			submit: this.closeHandler.bindWithEvent(this)
		});


		$E('.x',this.wrapper).onclick = this.cancel.bindAsEventListener(this);

		this.parent = $(this.options.parent || document.body);
		this.options.container = this.options.container || this.parent;
	},
	/*
	 * Adds submit and cancel buttons to the form. 
	 * Also adds any additional buttons the user may want (from options.buttons)
	 */
	addButtons:function(options, buttons){
		// buttons
		if (options.cancelButton || options.submitButton){
			var submit = options.submitButton ? input({type:"submit", cls:"submit", value:options.submitButton}) : "";
			var cancel = options.cancelButton ? input({type:"button", cls:"cancel", value:"Cancel"}) : "";
			var others = "";
			if (buttons)
 				buttons.each(function(b){ others+= input({type:"button", cls:b.cls, value:b.value, name:b.name});});
			var buttonArea = document.createElement("div");
			buttonArea.className = "buttonset";
			buttonArea.innerHTML = others + submit + cancel;

			// append them to the end of a form in the dialog, if a form exists.
			var container = $E('form',this.dialogBody) ? $E('form',this.dialogBody) : this.dialogBody;
			container.appendChild(buttonArea);
		}
	},
	buildDialogHtml:function(options){
		var html = "";
		// X button in the upper right
		html += a({href:"#",cls:"x close"},"");
		if (options.title) html += h4(options.title);
		html += div({cls:"contents"},options.contents);		

		return html;			
	},
	closeHandler:function(ev){
		this.close(false,ev);
	},
	close:function(cancelled,ev){
	
		// "cancelled" might be the event args from a click*
		var eventArgs={
			cancelled:cancelled==true ? true : false,
			dialog:this.wrapper,
			eventArgs:ev
			};
		
		// If the onClose handler is going to submit the form or something, we shouldn't remove it
		// from the DOM. So onClose can return "true" to cancel removing it from the DOM.
		var cancelRemove = false;

		// the onClose handlers can set eventArgs.cancelClose = true
		if (this.options.onClose)
			this.options.onClose(eventArgs);
		
		if (!eventArgs.cancelClose){
			this.wrapper.hide();
			// Don't leave this thing sitting in the DOM
			this.wrapper.parentNode.removeChild(this.wrapper);
			
			// leaving the overlay on if they told us not to close the dialog
			if (this.overlay)
				this.overlay.remove();
		}
			
		return false;
	},
	cancel:function(ev){
		return this.close(true,ev);
	},

	centerInsideParent:function(){
		// center this dialog inside its parent
		var p = (this.parent == document.body) ? window : this.parent;
		var parentPos = p.getSize();	
		var parentCenter={			
			 x:p.getWidth()/2,
			 y:p.getHeight()/2
		};
		
		// Move this thing offscreen and then show it, so we can calculate its dimensions and center
		// it. Safari won't let us check an element's dimensions when it's displayed 'none'. 
		// TODO: remove this is safari 3 supports it.
		this.wrapper.style.left="-9000px";

		// Don't cause vertical scrolling
		this.wrapper.style.top=0;
		this.wrapper.style.left=0;

		this.wrapper.show();

		var dialogLeft = parentCenter.x - this.wrapper.offsetWidth/2;
		var dialogTop = this.options.top || (parentCenter.y - this.wrapper.offsetHeight/2);
		
		this.wrapper.style.left = dialogLeft+"px";
		this.wrapper.style.top = dialogTop+"px";

		// Don't put an overflow style on the dialog wrapper before we do the adjust edges call,
		// or else the dialog will always just scroll when it's outside of the browser's viewport
		// and there will be no edges to adjust.
		this.adjustEdges(this.wrapper);
	},

	/*
	* Move the dialog contents into the dialog wrapper, then show it.
	*/
	show:function(){
		if (!this.wrapper.getParent())
			this.parent.appendChild(this.wrapper);
				
		this.wrapper.style.overflow="";
		this.wrapper.style.width="";

		// this.contents.style.display="";
		
		if (this.options.showAnimation)
			this.options.showAnimation(this.wrapper);
		else
			this.centerInsideParent();
		
		// Fixes mozilla form field focus issues on elements hovering over iframes. See comments at top of file.
		// If we set the overflow to auto and the width isn't set explicitly, and the dialog "spills out" of its parent,
		// then it will shrink to be the size of its parent and you'll get a weird scrollbar. So, set its width explicitly
		this.wrapper.style.width = this.wrapper.getStyle('width');
		this.wrapper.style.overflow="auto";
		
		if (this.options.modal){
			if (!this.overlay) this.overlay = new Overlay();			
			this.overlay.show(this.parent);
		}
		
		// Focusing behavior must be done after the overlfow has been set
		if (this.form)
			this.form.show();
		
		// fire any user attached handlers for when the dialog gets displayed
		if (this.options.onShow)
			this.options.onShow();
	},
	/* 
	* Make sure no edges fall off the sides of the page, if we can avoid it
	*/
	adjustEdges:function(element){

		element=$(element);
		var w = $(this.options.container);
		if (w==document.body) w = window;
		var s = w.getSize();	
		var containerCoords = w.getCoordinates();
		var coords = element.getCoordinates();
		log("size:",s);
		log("container coords:",containerCoords);
		cc = containerCoords;
		// don't line the dialogs right up against the edge of the page
		var scrolled = s.scrollSize.y > s.size.y;
		var pad=3;
		
		// if our container has a scrollbar, pad a bit more on the right. In Moz, container always has a scrollbar
		// IE needs about 20, moz needs about 17.
		var rightPad=19;

		// TODO delete
		// IE doesn't factor in the relative position of the overflowContainer on the page
		// we could avoid doing this by using containerCoords.top
		// if (window.ie && this.options.container){
		// 		coords.bottom-=w.getTop();
		// 		coords.top-=w.getTop();
		// }
		// 
		
		/* using scroll size for vertical, and regular size for horiz */
		if (coords.bottom>containerCoords.top+s.scrollSize.y+pad){
		// if (coords.bottom>s.scrollSize.y+pad){
			log("clips bottom");
			element.style.top=element.getStyle('top').toInt()-(coords.bottom-(containerCoords.top+s.scrollSize.y+pad));
			// element.style.top=element.getStyle('top').toInt()-(coords.bottom-s.scrollSize.y+pad);
		}
		coords = element.getCoordinates();

		if (coords.top<(containerCoords.top+pad))
			element.style.top=element.style.top.toInt()+(containerCoords.top+pad-coords.top) + "px";
		

		// if (coords.right + rightPad > s.size.x){
		if (coords.right + rightPad > containerCoords.right){
			log("clips right");
			// log("moving the dialog left. Old left:", element.style.left);
			var q = (element.getStyle('left').toInt()-(coords.right+rightPad-containerCoords.right));
			element.style.left=q+"px";
		}
		// adjusting left. We don't really care about this one, for now
		// coords = element.getCoordinates();
		// if (coords.left<containerCoords.left)
		// 	element.style.left=pad+"px";		
	}

});

ModalDialog.implement(new Events);

ModalDialog.init=function(){
	// Build the dialog wrapper. It has two elements of padding. Refer
	// to jjot.css for details.
	var wrapperHTML = 
		div(
			{cls:"padding"},
			div(
				{cls:"dialog-body padding2"}
			)
		);
	var t = document.createElement("div");
	t.className="dialog dialog-wrapper";
	t.style.display="none";
	t.innerHTML=wrapperHTML;	
	this.dialogWrapperTemplate=t;	
};
