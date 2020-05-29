/*
 * All the utility stuff that rte might need
 */

rte.util={};
rte.util.Node={

	findParentWithTag:function(node,tagName, limit){
		if (!node.tagName)
			node=node.parentNode;
		
		while (node && node.tagName!=tagName && node!=limit)
			node=node.parentNode;

		return node==limit ? null : node;
	},
	nextTextNode:function(node){
		do{
			node=node.nextSibling;
		}while (node!=null && node.nodeType!=3);
		return node;
	}
};
rte.util.Display={
	/*
	 * Calculates the height of a line by inserting an empty text node into the document and getting its height
	 */
	lineHeight:function(){
		
		if (!this.heightNode || !this.heightNode.parentNode){
			var h = document.createElement("span");
			h.style.position="absolute";
			h.style.visibility="hidden";
			h.style.left=h.style.top=0;
			h.id="lineheight-calc";
			h.innerHTML="&nbsp;";
			document.body.appendChild(h);			
			this.heightNode=$(h);
		}
		return this.heightNode.getStyle('height').toInt();
	}
};
rte.util.HTML={
	/*
	 * Removes HTML entities from a string. "<hey>you</there>" => "you"
	 */
	scrapeText:function(str){
		return str.replace(this.blockRegex,' ').replace(this.removeHTMLRegex,'');
	},
	removeHTMLRegex:new RegExp("<[^<]*>","g"),
	// matches block elements that we might want to replace with spaces, so text doesn't run together.
	blockRegex:new RegExp("</(li|div|p|h\d)>","i")
};

/*
 *  Currently not used.
 */
rte.Mozilla = new Class({
	/*
	* Mozilla's selection can move outside of paragraphs. Can we prevent this? It's fricking weird when
	* Currently not in use. Do we even want to allow paragraphs?
	*/
	correctSelection:function(){
		var selectedRange = this.cw.getSelection().getRangeAt(0);
		var s = selectedRange.startContainer;
		// Don't mess with complicated selections
		if (s!=selectedRange.endContainer)
			return;

		// I think this scenario can only happen when you hit the "up" key on the first line.
		// So fix, put the selection inside the first paragraph
		if (!this.insideParagraph(s)){
			log("selection is not inside a paragraph node. Setting it to be inside the first p in the editor.");
			var p=this.cw.document.getElementsByTagName("P")[0];
			var newSel = this.cw.document.createRange();
			newSel.setStart(p,0);
			newSel.setEnd(p,0);				
			this.setSelection(newSel);
		}		
	},
	insideParagraph:function(node){
		while (node && node.tagName!="P")
			node=node.parentNode;

		// node will be null if we went past the body
		return node ? true : false;
	}
});