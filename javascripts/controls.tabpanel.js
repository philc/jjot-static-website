

if (typeof Controls == "undefined") Controls={};

Controls.TabPanel = new Class({
	tabClick:function(){
		this.parentNode.parentNode.tabPanel.activate(this);
		return false;
	},
	/*
	 * Appends a tab panel to element
	 */
	initialize:function(e){
		e=$(e);
		e.className="tab-panel";
		this.tabs = document.createElement("div");
		this.tabs.className="tabs";
		this.bodies = document.createElement("div");
		this.bodies.className="tab-bodies";
		e.appendChild(this.tabs);
		e.appendChild(this.bodies);
		e.tabPanel=this;
		// hack; focus the secondary tab on page load, for debugging ease
		// a=function(){this.activate(e.getElementsByTagName("a")[1]);}
		// a.delay(50,this);
	},
	addTab:function(name,contentNode){
		var a = document.createElement('a');
		a.href="#";
		a.innerHTML=name;
		a.onclick=this.tabClick;
		a.className="tab";
		this.tabs.appendChild(a);
		var tab = document.createElement("div");
		tab.className="tab";
		tab.appendChild(contentNode);
		
		this.bodies.appendChild(tab);
		
		contentNode.style.height="200px";
		if (this.tabs.childNodes.length==1)
			this.activate(a);
	},
	activate:function(a){	
		var i = util.dom.indexOfChildByTagName(a,"A");
		
		var links = util.dom.childrenWithTagName(a.parentNode, "A");
		util.dom.removeClass(links,"active");
		$(a).addClass('active');
		
		var divs = a.parentNode.parentNode.getElementsByTagName("div");
		
		var tabBody = a.parentNode.nextSibling;
		divs = tabBody.getElementsByTagName("div");
		var divs = util.dom.childrenWithTagName(tabBody, "DIV");
		
		// start with div #2, because the first div is the tab headers
		util.dom.removeClass(divs,"active");
		$(divs[i]).addClass("active");
	}
	
});