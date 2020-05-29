/*
* Shows a file-menu like drop down
*
* 
* usage:
* new Controls.FileMenu(
*	{text:"menu caption", handler:onclickHandler},
*	{text:"menu caption", disabled:true},
*	{toggleButton:element, outsideClick:handler}	// options 
* );
*
* or you can pass all of the above entries inside of an []
*
* Only one file menu can be active at a time (this is by design; it's good UI).
* That's done using the static methods on Controls.FileMenu
*/
if (typeof Controls == "undefined") Controls={};
Controls.FileMenu = new Class({
	initialize:function(){		
		// if they passed in an array, make that the contents of the arguments we're processing
		var args = arguments.length==1 && arguments[0] instanceof Array ? arguments[0] : arguments;

		var itemCount=0;		
		
		// build dom element
		var d = document.createElement("div");
		d.id="menu";
		d.className="menu";
		var ul = $(document.createElement("ul"));
		for (var i=0;i<args.length;i++)
		{
			// if it doesn't have a text property, it's an options object
			if (!args[i].text){
				this.toggleButton = args[i].toggleButton;
				this.outsideClickHandler=args[i].outsideClick;
				this.limit = args[i].limit;
				continue;
			}
			itemCount++;
			var e;
			if (args[i].disabled)
				e = document.createElement("span");
			else{			
				e = document.createElement("a");
				e.href="#";
				e.onclick = jjotutil.nullClick;
				if (args[i].handler)
					util.attach(e,"click",this.makeClickHandler(args[i].handler));		
			}
			e.innerHTML=args[i].text;
			ul.appendChild(e);
				
		}
		
		d.appendChild(ul);
		ul.getFirst().className="first";				
		this.el = new Element(d);
	},
	makeClickHandler:function(userFunction){
		return function(ev){
			var res = userFunction(new Event(ev));
			Controls.FileMenu.active.hide(); 
			return res;
		};
	},
	/* 
	* Shows the menu right under the given element, by inserting the menu into the element's parent.
	* The element is usually a toolbar button. I think this assumes that target's parent is position:relative
	*   width: optional. Force the menu to be a certain width. Usually only needed for IE.
	*/
	display:function(target, options){
		// there can only be one visible menu. If you click somewhere else, the menu gets hidden
		Controls.FileMenu.init();
		Controls.FileMenu.active=this;
		options=options || {};
		
		target=$(target);
		var parent = target.getParent();
		
		var left,top,right;
		
		if (options.anchorRight){
			// factor in the note's padding/drop shadow
			right = options.right || (target.getParent().getSize().size.x -
			(target.getLeft() - parent.getLeft() + target.getSize().size.x)-3);
			// right = options.right || (target.getLeft() - parent.getLeft()-1 + target.getSize().size.x);
		}else{
			left = options.left || (target.getLeft() - parent.getLeft()-1) ;
			// left = target.getLeft()-1;
			// not sure if below is correct
						
			// if the parent's position isn't relative, we need to take into account the offset of the parent
			// left = options.left || 
			// (parent.getStyle("position")=="relative") ? (target.getLeft() - parent.getLeft()-1) : target.getLeft();
		}
			
		top = target.getTop() - parent.getTop() + target.getSize().size.y;	
		top = options.top || target.getSize().size.y;	// this seems to work for both IE and moz

		var e = this.el;
		e.style.top=top+"px";

		if (options.anchorRight)
			e.style.right=right+"px";
		else
			e.style.left=left+"px";
		
		if (options.width) 
			e.style.width = e.getFirst().style.width = options.width.toInt()+"px";

		// annoyingly, it takes a second for these scrollbars to render,
		// unless we throw it in the body element first. That's what we're doing to do
		e.style.visibility="hidden";
		e.show();	// in case it was previously hidden
		
		document.body.appendChild(e);		
		
		var links = e.getElementsByTagName("a");
				
		if (this.limit && links.length>this.limit)
		{
			var itemSize = $(links[0]).getStyle("height").toInt();
			var padding = 4;	//padding on the menu's ul
			e.getFirst().style.height = Math.ceil(itemSize*this.limit)+padding+"px";
			e.getFirst().style.overflowY = "auto";
		}
		
		// inject before the target, so it's not in the tab order right after the object
		e.injectBefore(target);
		e.style.visibility="";		
	},
	visible:function(){ return this.el.getParent() && this.el.style.display!="none";},
	highlight:function(index){
		var links = this.el.getElementsByTagName("a");
		for (var j=0;j<links.length;j++)
			links[j].className=links[j].className.replace("highlight","");		
		
		links[index].className+=" highlight";
		
		this.el.getFirst().scrollUntilVisible(links[index],0);
		this.el.getFirst().scrollLeft=0;
	},
	outsideClick:function(ev){
		return (this.outsideClickHandler) ? this.outsideClickHandler(ev) : true;
	},
	hide:function(){
		this.el.hide();
		if (Controls.FileMenu.active==this) Controls.FileMenu.active=null;
		this.fireEvent('hide',this);
	},
	destroy:function(){
		this.hide();
		if (this.el.getParent())
			this.el.getParent().removeChild(this.el);
	}
});
Controls.FileMenu.implement(new Events());

Controls.FileMenu.extendStatic({
	/*
	 * Listens for click events in the window or in iframes;
	 */
	hideActive:function(ev){ 
		var a;
		if(a = Controls.FileMenu.active)
			if (a.outsideClick(ev)) a.hide();
	},
	click:function(ev){ 
		var a = Controls.FileMenu.active;
		if (!a) return;
		var ev = new Event(ev);
		if (ev.target!=a.toggleButton && !util.dom.descendsFrom(ev.target,a.el)){
			Controls.FileMenu.hideActive(ev);
		}
	},
	init:function(){
		if (!this.setupEvents){
			document.addEvent('mousedown',Controls.FileMenu.click);
			rte.Events.addEvent('click',Controls.FileMenu.click);
		}
		this.setupEvents=true;
	}
});