/*
* Used to show an overlay (1/2 opaque white rectangle) over some element, so everything
* inside that element is effectively disabled. Good for modal dialogs etc.
*
* Usage:
* 	o = new Overlay();
* 	o.show(myElement);
* 	...
* 	o.remove(myElement)
*
* Notes:
* 	The overlay gets appended to the element's DOM, so even if the element moves,
*  the overlay will stay right on top of it.
*/
Overlay=new Class({
	/*
	* Show the overlay, which disables all interaction with everything under it
	*
	* height: optional. Override the setting of "height=100%". Only useful for IE6 hacking.
	*/
	show:function(element){
		if (!this.overlay)
			this.overlay = new Element(Overlay.createElement());

		var o = this.overlay;
		
		element.appendChild(o);

		// Only needed if we want to block out the entire window (e.g., parent == body)
		if (element==document.body){
			var w = $(window).getSize();
			o.style.height=w.scrollSize.y + "px";
		}
		o.style.display="block";
	},
	/*
	* Remove the overlay from its parent
	*/
	remove:function(){
		if (!this.overlay) return;
		this.overlay.getParent().removeChild(this.overlay);
		this.overlay=null;		
	}
});

/*
* Create an overlay element
*/
Overlay.extendStatic({
	createElement:function(){
		var o = document.createElement("div");

		var s = o.style;
		s.display="none";

		o.className="overlay white-overlay";
	
		s.position="absolute";
		s.left=0;
		s.top=0;
		return o;
	}
});
