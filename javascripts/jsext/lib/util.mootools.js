/* 
* 
* Extensions to mootools
*
*/

/*
 * Extend a class to have static members. Class.extend will put the given
 * members on the instance (prototype)
 * This should show up in mootools sometime.
 */
Class.prototype.extendStatic = function(methods){
	for (m in methods) this[m] = methods[m];
};

Array.extend({
	last:function(){ return this[this.length - 1]; }
});

/* 
 * handles a string as a map argument
 */
Array.prototype.oldMap = Array.prototype.map;
Array.prototype.map = function(fn, bind){
	if (typeof fn == "string"){
		var fnName = fn;
		fn = function(e){ return e[fnName](); };
	}
	return this.oldMap(fn, bind);
};

window.extend({
	getCoordinates: function(){
		var o = {
			'width': this.getWidth(),
			'height': this.getHeight(),
			'left': 0,
			'top': 0
		};
		o.right = o.left + o.width;
		o.bottom = o.top + o.height;
		return o;
	}
});

/*
 * iphone detection
 */
window.iphone = navigator.userAgent.contains('iPhone');

Element.extend({
	// so we can call getWidth on both elements and the window object
	getWidth:function(){ return this.offsetWidth; },
	getHeight:function(){ return this.offsetHeight; },
	
	hide:function(){ this.setStyle('display', 'none'); },
	show:function(){ this.setStyle('display', ''); },
	
	/* arg: force hide */
	toggle:function(arg){
		if (!this.isDisplayed() && arg != false) 
			this.show();
		else
			this.hide();
	},
	setDisplayed:function(visible){
		 visible ? this.show() : this.hide();
	},
	isDisplayed:function(){
		return this.style.display != "none";
	},
	/*
	* Focuses the first input field contained within this element
	*/	
	focusFirstInput:function(){
		var f = this.getElementsByTagName("INPUT")[0];
		if (f) f.focus();
	},
	/*
	 * Fades the element to visible or invisible
	 * display: Optiona; force the fade to show the element (true) or hide it. Default is !hidden()
	 */ 
	toggleWithFade:function(duration, display){
		display = display || this.hidden();
		// duration might not be an int if it was used as an onclick event handler
		duration = typeof(duration) != "number" ? 750 : duration;
		display ? this.fadeIn(duration) : this.fadeOut(duration);			
		return false;
	},
	hidden:function(){
		return this.style.display == "none";
	},
	// using .99 for opacity. Going to 1.0 is a display bug for firefox on mac.
	fadeIn:function(duration){
		var opacity = this.getStyle("opacity");
		// if fully visible, start from 0.
		if (opacity == 1) {
			opacity = 0;
			this.setStyle("opacity", opacity);
		}
		this.style.display = '';
		if (this.fade) this.fade.stop();
		this.fade = this.effect('opacity', { duration: duration || 750, wait:false }).start(opacity, .99);
	},
	fadeOut:function(duration){
		if (this.fade) this.fade.stop();
		this.fade = this.effect('opacity', { duration: duration || 750, wait:false });
		this.fade.start(this.style.opacity || 1, 0).chain(function(){ this.hide(); }.bind(this));
	},
	
	/*
	 * Scrolls the given element into view.
	 * I'd name it scrollIntoView, but that name is used by Mozilla.
	 * 
	 * duration: optional int. 300 by default. 0 => instant scrolling.
	 */
	scrollUntilVisible:function(childElement,duration){
		childElement = $(childElement);
		var size = this.getSize();		
		// var top = this.getTop()+20;
		var top = this.getTop();
		var bottom = size.size.y + top + size.scroll.y;

		var child = childElement.getCoordinates();

		var clipsBottom = (bottom < child.height + child.top);
		var clipsTop = (top + size.scroll.y > child.top);

		duration = (duration == null) ? 300 : duration;

		// IE can lag a second behind, so scrolling can get messed up sometimes. When duration is zero,
		// use the direct method, not the scroll object. Both the Fx.Scroll object and Element have
		// scrollTo method.
		var scroller = duration == 0 ? this : new Fx.Scroll(this, { duration:duration });
		
		if (clipsTop){
			// log("clips top");
			scroller.toElementWithOffset(childElement, top);
		}else if (clipsBottom){
			// log("clips bottom");
			// don't put the bottom of the element flush against the bottom of the screen
			var scrollPadding = 10;
			
			// if the note is _really_ tall and can't fit on the screen,
			// we should scroll to the top of the note. If it can fit on the screen,
			// we should do the least disruptive thing, which is scroll just enough
			// so that the bottom of the note isn't offscreen
			if (size.size.y > child.height+scrollPadding){	
				scroller.scrollTo(0,child.top-top-(size.size.y-child.height) + scrollPadding);
				// scroll.scrollTo(0,child.top-top-(size.size.y-child.height) + scrollPadding);
			}else{
				scroller.toElementWithOffset(childElement,top);	
				// scroll.toElementWithOffset(childElement,top);	
			}
		}
	},
	// scroll to an element with an offset
	toElementWithOffset: function(el,offset){
		var left = this.getLeft() - $(el).getLeft();
		return this.scrollTo(left, $(el).getTop() - offset);
	}
	
});

/* 
* Added so you can scroll to an element, but not bring it to the very top of the window 
*/
if (Fx.Scroll){
	Fx.Scroll = Fx.Scroll.extend({
		toElementWithOffset: function(el,offset){
			var left = this.element.getLeft() - $(el).getLeft();
			return this.scrollTo(left, $(el).getTop()-offset);
		}
	});
}
window.toElementWithOffset = function(element,offset){
	this.scrollTo(element.getLeft(),element.getTop()-offset);
};

// so we can use Rail's rjs templates with Mootools. Rjs templates call Element.update(id,contents)
Element.update = function(id, contents){ $(id).innerHTML = contents; };
