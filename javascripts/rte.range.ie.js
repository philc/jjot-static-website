/*
 *
 * This was originally taken, and modified from
 * http://mozile.mozdev.org/0.8/src/dom/InternetExplorerRange.js
 *
 * Notes:
 * ported to mootools
 * I'm not confident that this works when you build the range from IE's selection right after a title node..
 *
 * This is the original license block:
 */
 /* ***** BEGIN LICENSE BLOCK *****
 * Licensed under Version: MPL 1.1/GPL 2.0/LGPL 2.1
 * Full Terms at http://mozile.mozdev.org/0.8/LICENSE
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jorgen Horstink and David Kingma's code.
 *
 * The Initial Developers of the Original Code are Jorgen Horstink and David Kingma.
 * Portions created by the Initial Developer are Copyright (C) 2005-2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	James A. Overton <james@overton.ca>
 *
 * ***** END LICENSE BLOCK ***** */

/**
 * @fileoverview Provides a W3C Range implementation under Internet Explorer.
 * <p>History: The original code was written by Jorgen Horstink (http://jorgenhorstink.nl/2006/03/11/w3c-range-in-internet-explorer/).
 * It was extensively modified by David Kingma.
 * This version has been adapted for use with Mozile by James A. Overton.
 * Key changes include wrapping the objects in the Mozile namespace, so as to minimize the impact on other scripts in the same page.
 *
 * @link http://mozile.mozdev.org 
 * @author James A. Overton <james@overton.ca>
 * @version 0.8
 * $Id: InternetExplorerRange.js,v 1.3 2006/08/28 12:43:37 jameso Exp $
 */

rte.Range.IERange = Class({
	initialize:function(range){
		this._range=range;
		this.collapsed=null;
		this.commonAncestorContainer=null;
		this.startContainer=null;
		this.startOffset=null;
		this.endContainer=null;
		this.endOffset=null;
		
		//startPoint
		var beginRange = this._range.duplicate();
		beginRange.collapse(true);
		
		if (typeof thr !="undefined" && thr) throw "come debug me";
									
		var position = this._getPosition(beginRange);
		this.startContainer = position.node;
		this.startOffset = position.offset;

		
		//endPoint
		var endRange = this._range.duplicate();
		endRange.collapse(false);
		position = this._getPosition(endRange);
		this.endContainer = position.node;
		this.endOffset = position.offset;

		this._commonAncestorContainer();
		this._collapsed();
		
	},
	// philc
	isTextNode:function(type){
		return ["textnode","whitespace"].test(type);
	},
	newRange:function(){
		return document.body.createTextRange();
	},
	/**
	 * Takes an Internet Explorer TextRange object and returns a W3C node and offset pair.
	 * <p>The basic method is as follows:
	 * <ul><li>Create a new range with its start at the beginning of the element and its end at the target position. Set the rangeLength to the length of the range's text.
	 * <li>Starting with the first child, for each child:
	 * <ul><li>If the child is a text node, and its length is less than the rangeLength, then move the range's start by the text node's length.
	 * <li>If the child is a text node and its length is less than the rangeLength then we've found the target. Return the node and use the remaining rangeLength as the offset.
	 * <li>If the child is an element, move the range's start by the length of the element's innerText.
	 * </ul></ul>
	 * <p>This algorithm works fastest when the target is close to the beginning of the parent element.
	 * The current implementation is smart enough pick the closest end point of the parent element (i.e. the start or the end), and work forward or backward from there.
	 * @private
	 * @param {TextRange} textRange A TextRange object. Its start position will be found.
	 * @type Object
	 * @return An object with "node" and "offset" properties.
	 */
	_getPositionOriginal: function(textRange) {
		
		// philc - let's try this out.. textRange.parentElement can be wrong
		//var element = textRange.parentElement();
		var element = this._range.parentElement();
		var range = document.body.createTextRange();
		range.moveToElementText(element);
		range.setEndPoint("EndToStart", textRange);
		var rangeLength = range.text.length;
		
		// Choose Direction
		if(rangeLength < element.innerText.length / 2) {
			var direction = 1;
			var node = element.firstChild;
		} else {
			direction = -1;
			node = element.lastChild;
			range.moveToElementText(element);
			range.setEndPoint("StartToStart", textRange);
			rangeLength = range.text.length;
		}

		// Loop through child nodes
		while(node) {
			var type = $type(node);
			// assuming we're moving to siblings. We might occasionally have to move down the tree,
			// in which case this would become true
			var moveToSibling=true;
			switch(type) {
				case "textnode":
				case "whitespace":
					nodeLength = node.data.length;
					if(nodeLength < rangeLength) {
						var difference = rangeLength - nodeLength;
						if(direction == 1) range.moveStart("character", difference);
						else range.moveEnd("character", -difference);
						rangeLength = difference;
					}
					else {
						if(direction == 1) {
							if (typeof thr !="undefined" && thr) throw "come debug me";
							return {node: node, offset: rangeLength};
						}
						else {
							if (typeof thr !="undefined" && thr) throw "come debug me";
							return {node: node, offset: nodeLength - rangeLength};
						}
					}
				break;

				case "element":
					nodeLength = node.innerText.length;
					// philc
					if (nodeLength > rangeLength){	// doing = here fails when we double click "alright" after the title node
						// The end of the range must lie somewhere inside this element
						// Descend down into it until we find the text element
						if(direction == 1) node = node.firstChild;
						else node = node.lastChild;
						moveToSibling=false;
					}else{
						// End of range lies beyond this node. Move past it.
						if(direction == 1) range.moveStart("character", nodeLength);
						else range.moveEnd("character", -nodeLength);
						rangeLength = rangeLength - nodeLength;
					}
					break;
			}
			
			if (!moveToSibling) continue;
			
			if(direction == 1) node = node.nextSibling;
			else node = node.previousSibling;
		}


		// TODO: This should throw a warning.
		//throw("Error in mozile.dom.InternetExplorerRange._getPosition: Ran out of child nodes before the range '"+ textRange.text +"' inside '"+ mozile.xpath.getXPath(element) +"' was found.");
		// The TextRange was not found. Return a reasonable value instead.
		if (typeof thr !="undefined" && thr) throw "come debug me";
		return {node: element, offset: 0};

	},

	// this version ignores newlines and carriage returns, because they throw off the offset calculations
	// and don't show up in the contents of any nodes while we're traversing the tree; \n and \r just show up
	// in the ranges.
	junkChars:/[\n\r]/,
	junkCharsGlobal:/[\n\r]/g,
	filterRangeText:function(str){
		return str.replace(this.junkCharsGlobal,"");
	},
	
	_getPosition: function(textRange) {		
		// philc - sometimes the textRange parent element can be wrong. Just use ._range.parentElement();
		// should be ok.		
		//var element = textRange.parentElement();
		var element = this._range.parentElement();
				
		var range = document.body.createTextRange();
		range.moveToElementText(element);
		range.setEndPoint("EndToStart", textRange);
		var rangeLength = this.filterRangeText(range.text).length;
		
		// Choose Direction
		if(rangeLength < element.innerText.length / 2) {
			var direction = 1;
			var node = element.firstChild;
		} else {
			direction = -1;
			node = element.lastChild;
			range.moveToElementText(element);
			range.setEndPoint("StartToStart", textRange);
			rangeLength = this.filterRangeText(range.text).length;
		}

		// Loop through child nodes
		while(node) {
			// remove any bad chars off the front or back of the range
			if (direction==1){
				while (range.text.charAt(0).match(this.junkChars))
					range.moveStart("character",1);
			}else{
				while (range.text.charAt(range.text.length-1).match(this.junkChars))
					range.moveStart("character",-1);
			}
			// rangeLength = this.filterRangeText(range.text).length;			
			
			var type = $type(node);
			// assuming we're moving to siblings. We might occasionally have to move down the tree,
			// in which case this would become true
			var moveToSibling=true;
			switch(type) {
				case "textnode":
				case "whitespace":
					nodeLength = node.data.length;
					if(nodeLength < rangeLength) {
						var difference = rangeLength - nodeLength;
						if(direction == 1) range.moveStart("character", difference);
						else range.moveEnd("character", -difference);
						rangeLength = difference;
					}
					else {
						if(direction == 1) {
							if (typeof thr !="undefined" && thr) throw "come debug me";
							return {node: node, offset: rangeLength};
						}
						else {
							if (typeof thr !="undefined" && thr) throw "come debug me";
							return {node: node, offset: nodeLength - rangeLength};
						}
					}
				break;

				case "element":
					nodeLength = this.filterRangeText(node.innerText).length;
					// philc
					if (nodeLength > rangeLength){	// doing = here fails when we double click "alright" after the title node
						// The end of the range must lie somewhere inside this element
						// Descend down into it until we find the text element
						if(direction == 1) node = node.firstChild;
						else node = node.lastChild;
						moveToSibling=false;
					}else{
						// End of range lies beyond this node. Move past it.
						if(direction == 1) range.moveStart("character", nodeLength);
						else range.moveEnd("character", -nodeLength);
						rangeLength = rangeLength - nodeLength;
					}
					break;
			}
			
			if (!moveToSibling) continue;
			
			if(direction == 1) node = node.nextSibling;
			else node = node.previousSibling;
		}


		// TODO: This should throw a warning.
		//throw("Error in mozile.dom.InternetExplorerRange._getPosition: Ran out of child nodes before the range '"+ textRange.text +"' inside '"+ mozile.xpath.getXPath(element) +"' was found.");
		// The TextRange was not found. Return a reasonable value instead.
		if (typeof thr !="undefined" && thr) throw "come debug me";
		return {node: element, offset: 0};

	},
	/**
	 * Find the TextRange offset for a given text node and offset. Effectively the opposite of getPosition().
	 * The method used is to count the innerText length for elements and the data length for text nodes.
	 * @private
	 * @param {Text} startNode The target text node.
	 * @param {Integer} startOffset
	 * @type Integer
	 */
	/* todo philc: this method just doesn't work perfectly. The textrange can be one off, depending on whether
	 * the DOM has been normalized, and there's no distinguishable difference between the one-off and correct-offset
	 * DOM trees. When the DOM is one off, you can do a workaround like this: 
	 * range.move("Character",6), range.move("Character",-1) to get to character #5. But it's impossible to tell
	 * _when_ to use that workaround.
	 */
	_getOffset:function (startNode, startOffset) {
		var node, moveCharacters;
		
		var t = $type(startNode);
		if(this.isTextNode(t)) {
			moveCharacters = startOffset;
			node = startNode.previousSibling;
		}
		else if(t == "element") {
			moveCharacters = 0;
			if(startOffset > 0) node = startNode.childNodes[startOffset - 1];
			else return 0;
		}
		else {
			// mozile.debug.inform("_getOffset", "Bad node given: "+ mozile.xpath.getXPath(startNode));
			log("bad node given, apparently");
			return 0;
		}

		while (node) {
			var nodeLength = 0;
			var t = $type(node);
			if(t == "element") {
				nodeLength = node.innerText.length;
				if(this._isChildless(node)) nodeLength = 1; // Tweak childless nodes.
				// I'm not sure this is accurate. disabling - philc
				if(this._isBlock(node)) nodeLength++; // Tweak block level elements.
				// this was always disabled
				//if(nodeLength == 0) nodeLength++; // minimum length is 1
			}
			// else if($type(node) == "textnode") {
			else if (this.isTextNode(t)){
				 nodeLength = node.data.length;
			}
			moveCharacters += nodeLength;
			node = node.previousSibling;
		}
		return moveCharacters;
	},
	/* 
	 * philc
	 * Same function as _getOffset, but uses ranges to overcome IE's idosyncracies in the doc tree,
	 * and avoid the dubious guesswork (isChildless, isBlock) of getOffset
	 */
	_getOffsetFromParent:function(startNode,startOffset){
		var node, moveCharacters;
		var range = document.body.createTextRange();
		var t = $type(startNode);
		if(this.isTextNode(t)) {
			moveCharacters = startOffset;
			node = startNode.previousSibling;
		}
		else if(t == "element") {
			moveCharacters = 0;
			if(startOffset > 0) node = startNode.childNodes[startOffset - 1];
			else return {moveCharacters:0};
		}
		else {
			// mozile.debug.inform("_getOffset", "Bad node given: "+ mozile.xpath.getXPath(startNode));
			log("bad node given, apparently");
			return 0;
		}
		while (node) {
			var nodeLength = 0;
			var t = $type(node);
			if(t == "element") {
				// nodeLength = node.innerText.length;
				// if(this._isChildless(node)) nodeLength = 1; // Tweak childless nodes.
				// I'm not sure this is accurate. disabling - philc
				if(this._isBlock(node)) moveCharacters++; // Tweak block level elements.
				// this was always disabled
				//if(nodeLength == 0) nodeLength++; // minimum length is 1
				range.moveToElementText(node);
				break;
			}
			// else if($type(node) == "textnode") {
			else if (this.isTextNode(t)){
				 nodeLength = node.data.length;
			}
			moveCharacters += nodeLength;
			node = node.previousSibling;
		}
		return {range:range,moveCharacters:moveCharacters};
	},
	
	/**
	 * Internet Explorer pads certain elements with an extra space at the end. This method detects those elements.
	 * TODO: This method should be smarter about detecting non-HTML or using CSS.
	 * @param {Node} node The node to check.
	 * @type Boolean
	 */
	_isBlock: function(node) {
		switch (node.nodeName.toLowerCase()) {
			case 'p':
			case 'div':
			case 'h1':
			case 'h2':
			case 'h3':
			case 'h4':
			case 'h5':
			case 'h6':
			case 'pre':
				return true;
		}
		return false;
	},

	/**
	 * Internet Explorer sets the length of certain elements which cannot have child nodes to 1.
	 * TODO: Complete this list.
	 * @param {Node} node The node to check.
	 * @type Boolean
	 */
	_isChildless: function(node) {
		switch (node.nodeName.toLowerCase()) {
			case 'img':
			case 'br':
			case 'hr':
				return true;
		}
		return false;
	},

	
	// == positioning ==
	/**
	 * Sets the start position of a Range
	 * If the startNode is a Node of type Text, Comment, or CDATASection, then startOffset 
	 * is the number of characters from the start of startNode. For other Node types, 
	 * startOffset is the number of child nodes between the start of the startNode.
	 * @type Void
	 */
	setStart: function(startNode, startOffset){
		var container = startNode;
		if (typeof d2 !="undefined" && d2) throw "come debug me";
		// var t= $type(startNode);
		if(this.isTextNode($type(startNode))){
			// || 	startNode.nodeType == mozile.dom.COMMENT_NODE
			// ||	startNode.nodeType == mozile.dom.CDATA_SECTION_NODE
		
			container = container.parentNode;
		}
		var copyRange = this._range.duplicate();
		copyRange.moveToElementText(container);
		copyRange.collapse(true);

		var offsets = this._getOffsetFromParent(startNode,startOffset);
		if (offsets.range){
			offsets.range.collapse(false);
			copyRange.setEndPoint("EndToEnd",offsets.range);
			copyRange.collapse(false);
		}
		copyRange.move("Character",offsets.moveCharacters);

		// Sometimes, a chracter seems to be skipped after a block node. After hitting enter in the title,
		// try selecting the very char after the title using range.Move("Character",5) and range.Move("Character",5),
		// for example. You'll skip right over the character. But if you go past it and then back, it's selectable. Weird. 
		copyRange.move('Character',-1);
		
		this._range.setEndPoint('StartToStart', copyRange);
		
		
		//update object properties
		this.startContainer = startNode;
		this.startOffset    = startOffset;
		if (this.endContainer == null && this.endOffset == null) {
			this.endContainer = startNode;
			this.endOffset    = startOffset;
		}
		this._commonAncestorContainer();
		this._collapsed();
	},
	
	

	/**
	 * Sets the end position of a Range.
	 * Creates a clone of the current range, moves it to the desired spot
	 * and the we move the endPoint of the current range to the clones endpoint
	 * @type Void
	 */
	setEnd: function(endNode, endOffset) {
		// Store the start of the range
		var copyRange = this._range.duplicate();
		copyRange.collapse(true);

		var container = endNode;
		if(this.isTextNode($type(endNode))){
			container = container.parentNode;
		}

		copyRange = this._range.duplicate();
		copyRange.moveToElementText(container);
		copyRange.collapse(true);
		
		
		var offsets = this._getOffsetFromParent(endNode,endOffset);
		if (offsets.range){
			offsets.range.collapse(false);
			copyRange.setEndPoint("EndToEnd",offsets.range);
			copyRange.collapse(false);
		}
		copyRange.move("Character",offsets.moveCharacters);

		// Sometimes, a chracter seems to be skipped after a block node. After hitting enter in the title,
		// try selecting the very char after the title using range.Move("Character",5) and range.Move("Character",5),
		// for example. You'll skip right over the character. But if you go past it and then back, it's selectable. Weird. 
		copyRange.move('Character',-1);
		
		this._range.setEndPoint('EndToEnd', copyRange);

		//update object properties
		this.endContainer = endNode;
		this.endOffset    = endOffset;
		if (this.startContainer == null && this.startOffset == null) {
			this.startContainer = endNode;
			this.startOffset    = endOffset;
		}
		this._commonAncestorContainer();
		this._collapsed();
	},


	/**
	 * Sets the start position of a Range relative to another Node.
	 * The parent Node of the start of the Range will be the same as 
	 * that for the referenceNode.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	setStartBefore: function(referenceNode) {
		this.setStart(referenceNode.parentNode, util.dom.indexOfChild(referenceNode));
	},

	/**
	 * Sets the start position of a Range relative to another Node.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	setStartAfter: function(referenceNode) {
		this.setStart(referenceNode.parentNode, util.dom.indexOfChild(referenceNode) + 1);
	},

	/**
	 * Sets the end position of a Range relative to another Node.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	setEndBefore: function(referenceNode) {
		this.setEnd(referenceNode.parentNode, util.dom.indexOfChild(referenceNode));
	},

	/**
	 * Sets the end position of a Range relative to another Node.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	setEndAfter: function(referenceNode) {
		this.setEnd(referenceNode.parentNode, util.dom.indexOfChild(referenceNode) + 1);
	},

	/**
	 * Sets the Range to contain the node and its contents.
	 * The parent Node of the start and end of the Range will be the same as
	 * the parent of the referenceNode.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	selectNode: function(referenceNode) {
		this.setStartBefore(referenceNode);
		this.setEndAfter(referenceNode);
	},

	/**
	 * Sets the Range to contain the contents of a Node.
	 * The parent Node of the start and end of the Range will be the referenceNode. The 
	 * startOffset is 0, and the endOffset is the number of child Nodes or number of characters 
	 * contained in the reference node.
	 * @param {Node} referenceNode
	 * @type Void
	 */
	selectNodeContents: function(referenceNode) {
		this.setStart(referenceNode, 0);
		if($(referenceNode) == "textnode")
			this.setEnd(referenceNode, referenceNode.data.length);
		else
			this.setEnd(referenceNode, referenceNode.childNodes.length);
	},

	/**
	 * Collapses the Range to one of its boundary points.
	 * @param {Boolean} toStart When true the Range is collapsed to the start position, when false to the end position.
	 * @type Void
	 */
	collapse: function(toStart) {
		this._range.collapse(toStart);

		//update the properties
		if(toStart) {
			this.endContainer = this.startContainer;
			this.endOffset = this.startOffset;
		} else {
			this.startContainer = this.endContainer;
			this.startOffset = this.endOffset;
		}
		this._commonAncestorContainer();
		this._collapsed();
	},

	// == editing ==
	/**
	 * Returns a document fragment copying the nodes of a Range.
	 * Partially selected nodes include the parent tags necessary to make the 
	 * document fragment valid.
	 * @type Range
	 */
	cloneContents: function() {
		var df = document.createDocumentFragment();

		var container = this.commonAncestorContainer;
		 if(this.isTextNode($type(container))) {
 			// if (typeof thr!="undefined" && thr) throw("");	// philc logging
			df.appendChild(document.createTextNode(this._range.text));
			return df;
		}
		var endOffset = this.endOffset;
		var startNode = this.startContainer;
		// if(this.startContainer.nodeType != mozile.dom.TEXT_NODE)
		if ($type(startNode)!="textnode")
			startNode = this.startContainer.childNodes[this.startOffset];
		var endNode = this.endContainer;
		// if(this.endContainer.nodeType != mozile.dom.TEXT_NODE)
		if (!this.isTextNode($type(endNode))){
			endNode = this.endContainer.childNodes[this.endOffset-1];
			// added by philc:
			if (this.isTextNode($type(endNode)))
				endOffset = endNode.data.length;
			else
				endOffset = endNode.childNodes.length;	// philc: this might be a bit dodgy
		}

		if(startNode == endNode) {
			// philc:
			// if they're the same text node, they might have different offsets
			if (this.isTextNode($type(startNode))){
				df.appendChild(document.createTextNode(startNode.data.substring(this.startOffset,endOffset)));
			}else{
				for (var i=this.startOffset;i<endOffset;i++)	// maybe i<=..
					df.appendChild(startNode.childNodes[i].cloneNode(true));
				log("warning: we should be copying all children in this case");
				if (typeof thr!="undefined" && thr) throw("");
			}
			// if (typeof thr!="undefined" && thr) throw("");
			// 
			//df.appendChild(startNode.cloneNode(true));	// original body of this method.
			return df;
		}

		// Walk the tree.
		var current = container.firstChild;
		var parent = null;
		var clone;
		var content;	// this needs to be declared, or IE has trouble. -philc
		while(current) {
			//alert(current.nodeName +"\n"+ df.innerHTML);
			// Watch for the start node, then start adding nodes.
			if(!parent) {
				if(this.isAncestorOf(current, startNode, container)) {
					parent = df;
				}
				// Skip this node.
				else {
					current = current.nextSibling;
					continue;
				}
			}

			// Clone the node.
			if(current == startNode && $type(this.startContainer)=="textnode") {
				content = this.startContainer.data.substring(this.startOffset);
				parent.appendChild(document.createTextNode(content));
			}
			else if(current == endNode) {
				if($type(this.endContainer)=="textnode") {
					content = this.endContainer.data.substring(0,endOffset);
					parent.appendChild(document.createTextNode(content));
				}
				else parent.appendChild(endNode.cloneNode(false));
				// We're done.
				break; 
			}
			else {
				clone = current.cloneNode(false);
				parent.appendChild(clone);
			}

			// Move
			if(current.firstChild) {
				parent = clone;
				current = current.firstChild;
			}
			else if(current.nextSibling) {
				current = current.nextSibling;
			}
			// Climb the tree
			else while(current) {
				if(current.parentNode) {
					parent = parent.parentNode;
					current = current.parentNode;
					if(current.nextSibling) {
						current = current.nextSibling;
						break;
					}
				}
				else current = null;
			}
		}
		// if (typeof thr!="undefined" && thr) throw("");
		return df;
	},

	/**
	 * Removes the contents of a Range from the document.
	 * Unlike extractContents, this method does not return a documentFragment 
	 * containing the deleted content. 
	 * @type Void
	 */
	deleteContents: function() {
		this._range.pasteHTML('');//This is incorrect, it might also delete the container

		//update properties
		this.endContainer = this.startContainer;
		this.endOffset = this.startOffset;
		this._commonAncestorContainer();
		this._collapsed();
	},

	/**
	 * Moves contents of a Range from the document tree into a document fragment.
	 * @type DocumentFragment
	 */
	extractContents: function() {
		var fragment = this.cloneContents();
		this.deleteContents();
		return fragment;
	},

	/**
	 * Insert a node at the start of a Range.
	 * newNode is inserted at the start boundary point of the Range. If the newNodes 
	 * is to be added to a text Node, that Node is split at the insertion point, and 
	 * the insertion occurs between the two text Nodes
	 * 
	 * If newNode is a document fragment, the children of the document fragment are  
	 * inserted instead.
	 * @param {Node} newNode The node to insert.
	 * @type Void
	 */
	insertNode: function(newNode) {
		//salert('mozile.dom.InternetExplorerRange.insertNode() is not implemented yet');
		// if(this.startContainer.nodeType == mozile.dom.TEXT_NODE){
		if (this.isTextNode($type(this.startContainer))){
			// philc - sometimes the startOffset can be greater than the text node's size
			startOffset = this.startOffset > this.startContainer.data.length ? 
				this.startContainer.data.length : this.startOffset;
			
			this.startContainer.splitText(startOffset);
			this.startContainer.parentNode.insertBefore(newNode, this.startContainer.nextSibling);
			this.setStart(this.startContainer, startOffset);
			//Mozilla collapses, is this needed?
			//this.collapse(true);
			//this._range.select();
			return;
		} else { //Element node
			var parentNode = this.startContainer.parentNode;
			if(this.startContainer.childNodes.length == this.startOffset) {
				parentNode.appendChild(newNode);
			}else {
				this.startContainer.insertBefore(newNode, this.startContainer.childNodes.item(this.startOffset));
				this.setStart(this.startContainer, this.startOffset+1);
				//this._range.select();
				return;
			}
		}
	},

	/**
	 * Moves content of a Range into a new node.
	 * SurroundContents is equivalent to newNode.appendChild(range.extractContents());
	 * range.insertNode(newNode). After surrounding, the boundary points of the Range 
	 * include newNode.
	 * @param {Node} newNode The node to select.
	 * @type Void
	 */
	surroundContents: function(newNode) {
		newNode.appendChild(this.extractContents());
		this.insertNode(newNode);
	},

	// == Other ==
	/**
	 * NOT IMPLEMENTED. Compares the boundary points of two Ranges
	 * Returns a number, 1, 0, or -1, indicating whether the corresponding boundary-point of range is respectively before, equal to, or after the corresponding boundary-point of sourceRange
	 * Any of the following constants can be passed as the value of how parameter:
	 * Range.END_TO_END compares the end boundary-point of sourceRange to the end boundary-point of range.
	 * Range.END_TO_START compares the end boundary-point of sourceRange to the start boundary-point of range.
	 * Range.START_TO_END compares the start boundary-point of sourceRange to the end boundary-point of range.
	 * Range.START_TO_START compares the start boundary-point of sourceRange to the start boundary-point of range
	 * @param {Integer} how A code for the comparison method.
	 * @param {Range} sourceRange
	 * @type Void
	 */
	compareBoundaryPoints: function(how, sourceRange) {
		alert('mozile.dom.InternetExplorerRange.compareBoundaryPoints() is not implemented yet');
	},

	/**
	 * Returns a Range object with boundary points identical to the cloned Range.
	 * @type Range
	 */
	cloneRange: function() {
		var r = new mozile.dom.InternetExplorerRange(this._range.duplicate());
		var properties = ["startContainer", "startOffset", "endContainer", "endOffset", "commonAncestorContainer", "collapsed"];
		for(var i=0; i < properties.length; i++) {
			r[properties[i]] = this[properties[i]];
		}
		return r;
	},

	/**
	 * Releases Range from use to improve performance.
	 * @type Void
	 */
	detach: function() {},

	/**
	 * Returns the text of the Range.
	 * @type String
	 */
	toString: function() {
		return this._range.text;
	},

	/**
	 * Finds the commonAncestorComtainer.
	 * @private
	 * @type Element
	 */
	_commonAncestorContainer: function() {
		if(this.startContainer == null || this.endContainer == null){
			this.commonAncestorContainer = null;
			return;
		}
		if(this.startContainer == this.endContainer) {
			this.commonAncestorContainer = this.startContainer;	
		}
		else {
			// log("start container is not equal to end container");
			// this.commonAncestorContainer = mozile.dom.getCommonAncestor(this.startContainer, this.endContainer);
			this.commonAncestorContainer = this.getCommonAncestor(this.startContainer, this.endContainer);
			// probably need to implement above
			return null;
		}
	},
	/**
	 * Determines whether the ancestorNode is an ancestor of the descendantNode. If the ancestorNode is the descendantNode, the method returns true.
	 * @param {Node} ancestorNode 
	 * @param {Node} descendantNode 
	 * @param {Node} limitNode Optional. The search will stop at this node, no matter what happens. 
	 * @type Boolean
	 */
	isAncestorOf: function(ancestorNode, descendantNode, limitNode) {
		var checkNode = descendantNode;
		while(checkNode) {
			if(checkNode == ancestorNode) return true;
			else if(checkNode == limitNode) return false;
			else checkNode = checkNode.parentNode;
		}
		return false;
	},

	/**
	 * Returns the first node which is an ancestor of both given nodes.
	 * @param {Node} firstNode 
	 * @param {Node} secondNode
	 * @type Node
	 */
	getCommonAncestor: function(firstNode, secondNode) {
		var ancestor = firstNode;
		while(ancestor) {
			if(this.isAncestorOf(ancestor, secondNode)) return ancestor;
			else ancestor = ancestor.parentNode;
		}
		return null;
	},

	/**
	 * Check to see if this selection is collapsed, and assign a value to this.collapsed.
	 */
	_collapsed: function(){
		this.collapsed = (this.startContainer == this.endContainer && this.startOffset == this.endOffset);
	}	
	
});