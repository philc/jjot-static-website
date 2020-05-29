/*
 * Browser independent access to Ranges
 */
rte.Range = {
	moveToElementText:function(range){
		var node = range.startContainer;
		var offset= range.startOffset;
		while (node.nodeType!=3){
			node=node.childNodes[offset];
			offset=0;
		}
		range.setStart(node,offset);
	}
};

rte.Range.Extension = new Class({
	/*
	 * Buidls a range around the given offsets.
	 * If you ommit a startOffset, the whole startNode will be selected.
	 * If you ommit endNode and endOffset, the end will be the same as the start
	 */
	newRangeContaining:function(startNode,startOffset,endNode,endOffset){		
		var r = this.newRange();
		if (typeof startOffset == "undefined"){
			r.selectNode(startNode);
			return r;
		}

		r.setStart(startNode,startOffset);
		if (typeof endNode == "undefined")
			r.setEnd(startNode,startOffset);
		else
			r.setEnd(endNode,endOffset);
		return r;
	},
	
	newRange:function(){
		if (window.ie)
			return new rte.Range.IERange(document.body.createTextRange());
		else
			return this.documentNode().createRange();
	},
	/*
	 * Places the cursor inside of the given node, at the beginning
	*/
	placeCursorInside:function(node){
		if (window.ie){
			var s = document.body.createTextRange();
			s.moveToElementText(node);
			s.collapse(false);
			s.select();
		}else
			this.setSelection(this.newRangeContaining(node,0));

	},
	setSelectionAfter:function(node){	
		// restore selection
		var sel;
		var sib = node.nextSibling;
		// log(sib);
		// if (sib) log($type(sib));
		if (sib){
			// sel=this.newRangeContaining(sib,0);
			// r=this.newRange(); 
			// r.selectNode(sib);
			// r.collapse(true);
			// sel=r;
			sel = this.newRangeContaining(node.parentNode,util.dom.indexOfChild(sib));
		}
		else
			// one past the last real node; this will only work in IE if there's a node after this one
			// somewhere in the document. You could try walking up the tree until you find a sibling.
			sel = this.newRangeContaining(node.parentNode,util.dom.indexOfChild(node)+1);	
		
		this.setSelection(sel);
		return sel;
	},
		
	/*
	 * Builds a range that is set at the end position of the given node - this might be dubious
	 */
	selectionAtEndOfNode:function(node){
		if (node.nodeType==3)
			return this.newRangeContaining(node,node.nodeValue.length);
		else
			if (node.lastChild)
				return this.selectionAtEndOfNode(node.lastChild);
			else	// empty tag with no content, like a <br/>
				return this.newRangeContaining(node.parentNode,
					util.dom.indexOfChild(node.parentNode,node)+1);
	}	
});

