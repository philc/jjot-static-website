
/*
* Code monitoring a rich text editor's contents and changing url plain text into links.
* Hard to get working on Mozilla
*/

/*
* Checks if we're editing what looks like a link. If we are, ensure that it is a link.
*/
rte.LinkEditor=new Class({
	// test for "url of two letters and then a domain name, seperated by a period"
	// I wonder if this is expensive to run?
	domainRegex:/^((\w:\/\/)?[\w:\/]{2,}\.)+(com|org|net|us|info|gov|biz|jp|ca)(\/[\w\.#,?=]*)*$/,
	wordBoundariesRegex:/([\n\s\>\<!\t]+)/,
	// Don't include newlines \n as a word boundary; you can have html word\n.com that renders as word.com
	wordBoundariesRegex:/([\s\>\<!\t]+)/,

	/*
	* Breaks a big string into plain text nodes and links.
	* Returns the HTML for the text and links
	*/
	breakApart:function(string){
		// Search left to right, grouping URLs and non-URLs into results
		var tokens = string.split(this.wordBoundariesRegex);
		var html="";

		for (var i=0;i<tokens.length;i++){
			var str = tokens[i];
			if (!this.isUrl(str)){
				// replace spaces with &nbsp;
				html+=str.replace(/ /g,'&nbsp;');
			}
			else
			html+=this.linkHtml("http://www.google.com",str);

		}
		return html;
	},

	/*
	* Searches n characters to the left, starting with the given node,
	* Returns a range object around the found textnode at the correct offset.
	* start: a position; given if we're not starting at the end of the text in the current node
	*/
	searchLeft:function(startNode,n,start){		
		console.log("startNode,n,start:",startNode,n,start);
		while (n>=0 && startNode)
		{
			var textNode=this.findChildTextNode(startNode);
			startNode=startNode.previousSibling;
			if (!textNode)
				continue;

			var textLength = $pick(start,textNode.nodeValue.length);
			if (n-textLength<=0)
			{
				var newRange = this.cw.document.createRange();
				newRange.setStart(textNode,textLength-n);
				newRange.setEnd(textNode,textLength-n);
				return newRange;
			}
			n-=textLength;
		}
		return null;		
	},
	/*
	* descends down a node's children until it hits a textnode
	*/
	findChildTextNode:function(node){
		do{
			if (node.nodeType==3)
				return node;
			node = node.firstChild;
		}while(node);
		return null;
	},
	/*
	* Restores the user's selection after replacing the passed in selection with custom HTML.
	*/
	restoreSelectionAfterInsert:function(originalSelection,replacedSelection){
		log("restore selection after insert");
		// log.on(false);

		var selection = this.cw.getSelection().getRangeAt(0);
		var node = selection.startContainer;	
		log("repl sel:",replacedSelection);

		// After an HTML insert, current selection could either be in a text node or in the <body> tag
		var target = node.nodeType==3 ? node: node.childNodes[selection.startOffset-1];

		log("target chosen:",target);

		// Number of characters to the left to move the selection
		//var n = stringReplaced.length-originalSelection.startOffset;
		var n=0;
		log("node:",node);
		log("orig start offset:",originalSelection.startOffset);
		log("sel offset",selection.startOffset);

		var start=null;

		n=replacedSelection.endOffset - originalSelection.startOffset;
		log("n2",n);
		if (node.nodeType==3)
			start=selection.startOffset;
		var toSelect = this.searchLeft(target,n,start);

		log("final startOffset:",toSelect.startOffset);
		log(toSelect.startContainer);
		log("final endOffset:",toSelect.endOffset);
		log(toSelect);

		this.setSelection(toSelect);
		// log.on(true);
	},
	/*
	* This finds the nearest whole word to the user's text cursor. If that
	* word is a URL and is not a link yet, then we make it a link.
	* If it is a link, then we ensure that the link target is equal to the text.
	*/
	checkLinks:function(){
		// disabling for now... see "first-line" bugs at the top
		return;

		log("CHECK LINKS");
		var selection = this.cw.getSelection();
		var textNode = selection.anchorNode;

		// Only search within text ndoes
		if (textNode.nodeType!=3)
			return;

		// warning - There might be some crazy wild case in here where the range's
		// start anchor is not the same as its end anchor. Just return if that be the case?
		var nodeValue=textNode.nodeValue;		
		var range = selection.getRangeAt(0);
		var span = textNode.parentNode;

		// If our parent is a link, we're going to check its contents. If the link's text no longer
		// constitutes a link, remove the link. If it constitutes a partial link, like http://google.com [space]hi,
		// then leave the first part of the link intact, and move the [space]hi outside of the link
		if (span.parentNode && span.parentNode.tagName=="A"){
			if (!this.isUrl(nodeValue)){				
				log("string that's in this link (",nodeValue,") is not a url");
				// Check to see if this has any of the URL delimiters in it
				var newHtml = this.breakApart(nodeValue);
				log("new html:",newHtml);
				var originalSelection = new rte.RangeContainer(this.cw.getSelection().getRangeAt(0));		

				var replacedSelection = this.cw.document.createRange();

				// Select the <a> node
				replacedSelection.selectNode(span.parentNode);

				var toRestore = new rte.RangeContainer(replacedSelection);
				toRestore.startOffset=0;
				toRestore.endOffset=nodeValue.length;
				log("nodevalue:",nodeValue,nodeValue.length);
				log("building around",toRestore);

				// Select the contents of the span node
				var replacedSelectionContainer = new rte.RangeContainer(replacedSelection);
				// replacedSelectionContainer.startOffset=0;
				// replacedSelectionContainer.endOffset=nodeValue.length-1;



				//log("select node's char count:",replacedSelection.endOffset);

				// Select the text we want to link
				//this.setSelection(replacedSelectionContainer.buildRange(this.cw.document));
				//newHtml=newHtml.replace("&nbsp;","  ");
				this.makeSelectionIntoLink(replacedSelectionContainer,newHtml,false);
				//this.cw.document.execCommand("inserthtml",false,newHtml); 					
				//this.cw.document.execCommand("inserthtml",false,"<a href='#'>hey jude</a> "); 					

				//log("node value:","'"+nodeValue+"'");
				this.restoreSelectionAfterInsert(originalSelection,toRestore);	
				this.attachLinkHandlers();									
				return;
			}else{
				// TODO: Update the URL's contents to be the value of the link's new caption
				return;
			}
		}

		var wordRange = this.nearestWord(range);

		// If this word is a URL, wrap it in a link tag.
		if (this.isUrl(wordRange.contents)){
			//var originalSelection = new rte.RangeContainer(this.cw.getSelection().getRangeAt(0));
			this.makeSelectionIntoLink(wordRange,this.linkHtml("http://www.google.com",wordRange.contents),true);
			//this.restoreSelectionAfterInsert(wordRange,originalSelection);
		}
	},
	safeInsertHtml:function(wordRange,replaceWith){

	},
	makeSelectionIntoLink:function(wordRange, linkHtml, autoRestoreSelection){
		log("making current text selection into a new URL.");

		/*
		* massive mozilla bug.
		* conditions: if we select something and do an "insertHTML" command (and say, insert a link)
		* on a line that has been wrapped (the selection doesn't have to span lines)
		* and we have a "body:line-height" style defined (it can be empty, as long as its defined)
		* then the link will have no dimensions and the selection caret cannot enter the link.
		*
		* fix: make mozilla reflow the link. This is what we do: we perform the insertHTML operation.
		* if there's a broken link (no dimensions) afterwards, we undo that, hide the iframe, set its
		* overflow property to hidden, preform the operation, set its overflow to normal, and then unhide it.
		* We hide so there's no scrollbar flicker; it's just a white flicker. 
		* You could also completely rebuild the iframe without flicker, but this workaround preserves undo history.
		*/

		this.savedSel = new rte.SavedSelection(this);

		this.createLinkAroundRange(wordRange,linkHtml,autoRestoreSelection);

		if (this.hasBuggedLinkNodes()){
			log("there was a bugged link. Undoing");

			// Undo the changes to the document that caused the bugged link node
			this.cw.document.execCommand("undo",false,false);				

			this.savedSel.restore();		

			// If there's no scroll bar, there's no need to hide the iframe before we make changes.
			// There won't be a "scrollbar flicker" since there's no scrollbars
			var scrolled = this.cw.pageYOffset>0;

			if (scrolled){
				this.saveScrollPosition();
				// Hide the iframe quickly, so we don't get a jarring effect as the scroll gets reset
				// when we change the overlfow property
				this.iframe.style.visibility="hidden";
			}

			this.cw.document.body.style.overflow="hidden";

			// The bug is that we eat the extra <br/> tag in mozilla when we insert the html.
			// Add an extra <br/> tag to replace it, or mozilla will insert a <br/> tag for us,
			// potentially in a weird place like inside of the next link we insert.
			var modifiedHtml = linkHtml+"<br/>";
			//var modifiedHtml = linkHtml;
			log("inserting modified:",modifiedHtml);

			this.createLinkAroundRange(wordRange,modifiedHtml,autoRestoreSelection);

			// This will now reflow the contents of the iframe, causing the bugged mozilla link to be
			// repainted/refreshed, and no longer act bizzare.
			this.cw.document.body.style.overflow="";

			if (scrolled){
				this.restoreScrollPosition();			
				this.iframe.style.visibility="visible";			
			}
		}
	},
	/*
	* Checks a document for broken links, which can happen in Mozilla.
	* If a link has no dimensions, you can't move your selection cursor inside of it.
	*/
	hasBuggedLinkNodes:function(){
		var links = this.cw.document.getElementsByTagName("A");
		for (var i=0;i<links.length;i++){
			// Mozilla treats links that aren't working as having 0 dimensions. Check for a link
			// that takes up no space, and you'll find the bugged mozilla link
			if (links[i].hasAttribute("_moz_dirty") && links[i].offsetWidth==0){
				log("found dirty link:",links[i]);
				return true;
			}
		}
		log("did not find a dirty link");
		return false;
	},
	/*
	* Recyles an editor, destroying and rebuilding it, and restoring the user's selection.
	* Might use it if the editor gets corrupted in some way. Not used atm.
	*/
	recycle:function(){
		log("recycling");
		var s = new rte.SavedSelection(this);
		this.syncContents();
		this.buildIframe();
		s.restore();
	}
	/*
	* Finds the nearest whole word in the given range, and returns
	* a range container around it.
	*/
	// nearestWord:function(range){
	// 	// log.on(false);
	// 	var nodeValue=range.startContainer.nodeValue;
	// 	var i=range.startOffset>0 ? range.startOffset-1 : range.startOffset;
	// 	var j=range.endOffset;
	// 
	// 	log("start I,j:",i,j);
	// 	log("i border:",nodeValue[range.startOffset-1]);
	// 	log("j border:",nodeValue[range.endOffset+1]);
	// 	log("i value:",nodeValue[i]+'|');
	// 	//log("j value:",nodeValue[j]+"|",nodeValue[j].search(this.wordBoundariesRegex));		
	// 
	// 	while (i>0){
	// 		//if (this.wordBoundaries.test(nodeValue[i-1]))
	// 		if (nodeValue[i-1].search(this.wordBoundariesRegex)>=0)
	// 			break;
	// 		i--;
	// 	}
	// 	while (j<nodeValue.length){
	// 		//if (this.wordBoundaries.test(nodeValue[j]))
	// 		if (nodeValue[j] && nodeValue[j].search(this.wordBoundariesRegex)>=0)
	// 			break;
	// 		j++;
	// 	}
	// 
	// 	log("final I,j:",i,j);
	// 	log("final i value:",nodeValue[i]+'|');
	// 	log("final j value:",nodeValue[j]+"|");
	// 	var word = new rte.RangeContainer(range);
	// 	word.startOffset=i;
	// 	word.endOffset=j;
	// 
	// 	word.contents=nodeValue.substring(i,j);
	// 	// log.on(true);
	// 	return word;		
	// },
	/*
	* Creates a link around the text defined by the given offsets in such a way
	* that undo is supported. Maintains the user's selection.
	*/
	// createLinkAroundRange:function(range,linkHtml,autoRestoreSelection){		
	// 	var originalSelection = new rte.RangeContainer(this.cw.getSelection().getRangeAt(0));		
	// 
	// 	// Select the text we want to link.
	// 	this.setSelection(range.buildRange(this.cw.document));
	// 	this.cw.document.execCommand("inserthtml",false,linkHtml);
	// 	if (autoRestoreSelection)
	// 		this.restoreSelectionAfterInsert(originalSelection,range);
	// 
	// 	this.attachLinkHandlers();
	// },


	/*
	* determines whether the given word matches a URL pattern
	*/
	// isUrl:function(word){
	// 	// If we need to, for perf, we could declare that any url has to start with either
	// 	// http:// or www.
	// 	if (word.search(this.domainRegex)>=0)
	// 		return true;
	// 
	// 	return false;
	// }

});


