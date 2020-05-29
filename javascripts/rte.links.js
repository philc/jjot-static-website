/*
* Code for managing links
*/

/*
 * Tricky bits:
 * 
 * None of the rich text editors will let you click on links in the editor. We want to be able to open links
 *   by clicking on them, so we're overriding the mouseDown behavior and opening the link for you anyway.
 *
 * Midas and IE don't want to let you change the cursor type for a link. One way to get around this in Mozilla is to
 *  always use this HTML for a link: <a><span>...</span></a>. You can then set the CSS cursor attribute
 *  on the span and it will work (Midas only). You can also use a{cursor:pointer !important}, which Mozilla
 *  honors, and which we're using. For IE, we're changing the cursor
 *  property of the entire note onmouseover, and then put it back onmouseout (this doesn't work for Moz)
 *
 * When we hover over a link, we show a menu below it. If a link spans multiple lines, its dimensions are
 *  difficult to interpret. You don't want a dialog appearing under the second line -- you want it to show under the first.
 *  So we use a hack to get the line-height in pixels, relative to the current font size, and use that
 *  to figure out where to display the little hover button.
 *
 * A link's href inside an iframe doesn't appear in the status bar of Mozilla. 
 *  Mozilla won't let you change its status bar. Works in all other browsers.
 *
 * You can't just throw simple attributes on a DOM element in IE6. If you do
 *  myDiv.myProp="true", it will be serialized by IE: <div myProp="true">...</div>
 *  so you must always assign objects to the properties to avoid having them serialized
 *  (we don't want our book keeping variables serialized by the editor)
 */




rte.Links=new Class({
	/*
	 * used for determining whether a string is a domain. Very liberal:
	 * test for "url of two letters and then a domain name, seperated by a period"
	*/
	domainRegex:/^((\w:\/\/)?[\w:\/]{2,}\.)+(com|uk|de|org|net|us|info|gov|biz|jp|ca)(\/[\w\.#,?=]*)*$/,
	
	/*
	* When the link button the toolbar is clicked
	*/
	toolbarLink:function(){
		var selectedText = this.selectedRange();
		var node = selectedText.startContainer;

		// it might be the case that we need to do selectText.replace(/\n/,'') to remove newlines.
		// Newlines will mess with the link dialog. There really shouldn't be any newlines in the HTML, though.
		var caption = selectedText.toString();
		var href;
				
		// We might be editing an existing link
		var linkElement = rte.util.Node.findParentWithTag(node,"A");

		// if they've selected some text that looks like a link, make that text the href of the new link 
		if (!linkElement && caption.trim().match(this.domainRegex))
			href = caption.trim();
		
		return this.showLinkEditorDialog(linkElement,caption,href);

	},
	/*
	 * linkElement: the element we're editing. Optional.
	 */
	showLinkEditorDialog:function(linkElement,caption,href){
		rte.LinkMenu.hide();
		if (!this.linkDialog){
			var formHTML =
				form({action:"#", cls:"create-link-form"},
				TableLayout.build(
					[label("URL:"), input({type:"text", name:"url", cls:"field", value:"http://", autocomplete:"off"})],
					[label("Caption:"), input({type:"text", name:"caption", cls:"field", autocomplete:"off"})]
				)
			);			
		
			this.linkDialog = new ModalDialog({
				title: linkElement ? "Edit this link" : "Create a link",				
				submitButton: "Ok",
				contents: formHTML,
				container:Notes.overflowContainer,
				parent:this.textarea.note.element,
				onClose:this.dialogResult.bind(this),
				buttons:[{value:"Remove link",name:"remove-link", cls:"remove-link submit"}],
				onShow:function(){
					var url =$E('input[name=url]',this.linkDialog);
					if (url.value=="www.") url.select(); 
				}.bind(this)
			});

		}

		if (this.undoManager.isDirty)
			this.undoManager.saveState();

		// We'll lose the selection upon showing the dialog if it's CE. Save it.
		this.savedSelection = this.selectedRange();
		this.existingLink = linkElement;
		
		if (href == null)
		 	href = "www.";
		
		var dialogForm = $E('form',this.linkDialog.dialogBody);
		
		// if they're editing an existing link element, just take all dialog properties from that
		if (linkElement){
			log("editing existing");
			href = linkElement.href;
			log("link's href",linkElement.href);
			caption = util.unescapeHTML(rte.util.HTML.scrapeText(linkElement.innerHTML));
			
			// if their URL begins with http://, strip it
			if (href.toLowerCase().startsWith("http://"))
				href = href.substring(7);

			log(href);
		
			dialogForm["remove-link"].disabled = false;
		}else
			dialogForm["remove-link"].disabled = true;
		
		dialogForm["url"].value = href;
		dialogForm["caption"].value = caption;

		this.fireEvent('dialogShow',this);
		this.linkDialog.show();

		return false;
	},
	// todo: might be able to make the linking code actually use execCommand..
	protocols:["http://","https://","ffp://","mailto:"],
	dialogResult:function(ev){
		if (!ev.cancelled){	
			// see if they clicked the "remove link" button
			var targetElement = ev.eventArgs.target;
			var removeLink = targetElement && $(targetElement).hasClass("remove-link");

			var caption = util.escapeHTML($E('input[name=caption]',ev.dialog).value);
			
			var url = $E('input[name=url]',ev.dialog).value.trim();
			
			// Since we start with www. in the link, if they just quickly pasted a url
			// into the box already containing www., they might have www.http://
			// It's unlikely, since we have www. pre-selected, but just in case, clean it up
			// for them.
			url=url.replace(/www\.http:\/\//,"http://");
			
			// If they didn't put an http:// in front of their URL, put one on there for them.
			// otherwise the link will resolve relative to jjot.com				
			var startsWith = this.protocols.filter(function(p){ return url.startsWith(p);});
			if (startsWith.length==0)
				url="http://"+url;

			// If we're editing an existing link, select it and replace its contents with the new stuff.
			if (this.existingLink){
				var node;
				
				if (removeLink)
					node=this.documentNode().createTextNode(caption);
				else{
					node = this.documentNode().createElement("A");
					node.href=url;
					node.innerHTML=caption;
				}
				this.existingLink.parentNode.replaceChild(node,this.existingLink);				
				this.setSelectionAfter(node);
				this.existingLink=null;
			}else{
				var html =  "<a href='" + url +"'>"+caption+"</a>";
				this.setSelection(this.savedSelection);
				this.execCommand("inserthtml",html);
				// in IE, the new link can remain selected. Collapse to the right. TODO: Is this true?
				// var r = this.selectedRange();
				// r.collapse(false);
				// this.setSelection(r);
			}			
			this.undoManager.saveState();
			this.attachLinkHandlers();
			this.checkForChanges();
		}else{
			// if they cancelled, give them their selection back
			this.setSelection(this.savedSelection);
		}
		
		this.fireEvent('dialogHide',this);
		
		// iframes need to focus
		if (!this.ce) this.focus();
	},
	/* when a link gets clicked, manually force the browser to follow that link */
	linkClick:function(ev){
		var ev = new Event(ev);
		ev.stop();
		// TODO: also check for a dot in the url, or it will try and open an intranet url
		// and that will fail in IE

		// if you click on a link, the target might be one of its child nodes (like a bolded span).
		// find hte real link
		var target = rte.util.Node.findParentWithTag(ev.target,"A");
		if (!target.href.startsWith("http://"))
			return;
		if (true)
			window.open(target.href);
		else
			window.location = target.href;
	},
	/*
	 * Show edit menu for link. Also, show the link's href in the status bar.
	 */
	linkMouseOver:function(ev){
		// Don't show any link menus while we're dragging notes, or when we're not the owner of the board
		if (rte.dragging || Page.shared) return;
		
		$clear(rte.LinkMenu.timer);
		if (window.ie) this.bodyNode().style.cursor="pointer";

		ev = new Event(ev);
		
		var target = ev.target;

		// Sometimes we can be hovering over a span or something inside the link, and not the link itself.
		// Remedy taht
		if (target.tagName!="A")
			target=rte.util.Node.findParentWithTag(target,"A");
		
		target=$(target);
		window.status=target.href;
		
		// Make the coordinates relative to browser window, not the local iframe		
		var coords = target.getCoordinates();

		var relativeCoords = this.editorElement().getPosition();

		var bodyScroll = $(this.bodyNode()).getSize().scroll;

		// Account for scrolling of the notearea and the individual note when finding the coords of the link

		// CE uses the editor's parent as the overflow element; moz uses the iframe.
		var editorOverflow = this.ce ? this.bodyNode().parentNode : this.bodyNode();

		var coords = target.getCoordinates([Notes.overflowContainer,editorOverflow]);
		if (!this.ce){
			coords.left+= this.editorElement().getPosition().x;
			coords.top+= this.editorElement().getPosition().y;
		}
		rte.LinkMenu.show(coords,target,this);
	},
	linkMouseOut:function(){
		if (Page.shared) return;
		if (window.ie) this.bodyNode().style.cursor="";
		if (rte.LinkMenu.menu)
			rte.LinkMenu.hideWithDelay(150);
		window.status="";
	},
	/*
	* Attaches a clicked link event handler to every link in the iframe
	*/
	attachLinkHandlers:function(){
		var links = this.bodyNode().getElementsByTagName('A');
		for (var i=0;i<links.length;i++){
			// Using a direct onclick= doesn't work here (at least, in mozilla). Not sure why.
			//links[i].onclick=this.linkClick;

			// Since this attach method might be called lots of times, and we have no way
			// to see if we've already attached an event handler by the events themselves,
			// put in a custom attribute to check, so we don't add event handlers over
			// and over again
			if (!links[i].rteLinked){
				links[i].rteLinked={};
				util.attach(links[i],'click',this.linkClick);
				util.attach(links[i],'mouseover',this.linkMouseOver.bindAsEventListener(this));
				util.attach(links[i],'mouseout',this.linkMouseOut.bindAsEventListener(this));
			}
		}
	}
	

});

/*
 * This is the small menu that appears when you mouse over a link
 */
rte.LinkMenu={
	mouseoverClassname:"jj-mouseover",
	show:function(coords,linkElement,editor){
		var m = rte.LinkMenu.menu;
		// Might have to create the dialog for the first time
		if (!m){
			log("creating link menu");
			m = document.createElement("div");
			m.id="edit-link";
			m.style.position="absolute";
			m.style.display="none";			
			m.innerHTML="<a href='#'><div>edit</div></a>";			
			m.onmouseover=this.mouseOver;
			m.onmouseout=this.mouseOut;
			
			document.body.appendChild(m);	
			rte.LinkMenu.menu=$(m);
		}
		
		// Clear styles on old links
		if (this.currentLink)
			this.currentLink.removeClass(rte.LinkMenu.mouseoverClassname);
		this.currentLink=$(linkElement);
		this.currentLink.addClass(rte.LinkMenu.mouseoverClassname);			
		
		m.getElementsByTagName('a')[0].onclick = editor.showLinkEditorDialog.pass([linkElement],editor);
		
		m.style.left = coords.left-1+"px";
		
		// We want to put this button right under the first line of the link. Link might span many lines.
		m.style.top = coords.top + rte.util.Display.lineHeight()- 4 + "px";
		
		m.show();
	},	
	mouseOver:function(ev){
		$clear(rte.LinkMenu.timer);
	},
	mouseOut:function(ev){
		rte.LinkMenu.hideWithDelay(300);
	},
	hide:function(){if (m=rte.LinkMenu.menu) m.hide();},
	hideWithDelay:function(ms){
		rte.LinkMenu.timer=function(){
			rte.LinkMenu.menu.hide();
			rte.LinkMenu.currentLink.removeClass(rte.LinkMenu.mouseoverClassname);
			}.delay(ms);
	}
};
