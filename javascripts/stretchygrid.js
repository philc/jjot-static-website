
var StretchyGrid={	
	// Each note's width is calculated to be a % of the container's width
	container:null,
	// Notesize can be 1-10. Actual width and height are derived from this.
	noteSize:4,
	// Number of notes that currently fit on a line; changes when browser is resized
	notesPerLine:null,
	
	/*
	 * Binds to the window's resize event
	 */
	init:function(){
		// Start listening for resize events		
		$(window).addEvent('resize',this.recalcNoteWidths.bindAsEventListener(this));

		// this.container=$('content');		
		this.container=$('note-area');	
		
		// Load the note size from preferences
		var pref = ViewPreferences.getPreference("size");
		this.setNoteSize( pref ? pref.toInt() : this.noteSize);
	},
	/*
	* Checks to see if notes after a browser resize are wider than they're allowed to be.
	* If their widths are larger than some threshold, wrap some notes to the next line 
	*/
	recalcNoteWidths:function(){
		var containerWidth = this.container.getStyle('width').toInt();
		var d = StretchyGrid.noteDimensions(this.noteSize);
		var currentNotesPerLine=Math.floor(containerWidth/d.width);
		if (currentNotesPerLine!=this.notesPerLine || this.notesPerLine==null){
			this.notesPerLine=currentNotesPerLine;
			this.setNotesPerLine(currentNotesPerLine);
		}
	},
	/*
	* Update the width percentages of the notes based on how wide their
	* container is. If 4 can fit on a line currently, make sure all
	* of their widths are set to 25%.
	*/
	setNotesPerLine:function(perLine){
		// don't make the percents add up to 100%, or even 99%, in IE.
		// instead, subtract a small % from each note's width based on how wide the window is.
		// using 25px (~width of a scrollbar) as the percent we're subtracting from the parent's width
		var adjust=0;
		if (window.ie)
		 	adjust = (25/this.container.getStyle('width').toInt()*100)/perLine+0.1;
		Stylesheets.rules.note[0].style.width=(100/perLine)-adjust + "%";

		// When maximizing, make the maximized note's width the width of 3 notes,
		// unless that exceeds 100%
		var maximizedWidth = 100/this.notesPerLine*3;		
		Stylesheets.rules.maximized[0].style.width = maximizedWidth > 100 ? 100-(perLine*adjust)+"%" : maximizedWidth - adjust*3 + "%";
	},
	/*
	* Sets the approximate px width and height for notes
	*/	
	setNoteSize:function(size){
		if (size<2 || size>10)
			return;
		
		this.noteSize=size;
		
		var d = StretchyGrid.noteDimensions(this.noteSize);
		this.recalcNoteWidths();
		var rules = Stylesheets.rules;
		
		rules.note[0].style.height=(d.height)+"px";
		
		// not sure why
		if (window.ie)
			rules.ghostElementDiv[0].style.height=(d.height-12)+"px";
		else
			rules.ghostElementDiv[0].style.height=(d.height-8)+"px";

		// Maximized notes are twice the height of regular notes, plus the distance between notes				
		var heightBetweenNotes = Stylesheets.rules.note[0].style.marginBottom.toInt();
		
		// Also set the iframe's height to be the total height minus the toolbar height.
		// Filling up the remaining vertical space with the iframe is hard to do with css,
		// so we're doing it here in JS.		
		var noteEl = $E('.note');
		var paddingSize=36;	// start with an approximation, in case there's no notes to accurately calc from
		if (noteEl)
			paddingSize = this.notePaddingHeight(noteEl);
		
		// mozilla needs a bit of padding on the iframe..
		rules.editor[0].style.height = (d.height-paddingSize)+"px";
		rules.editorParent[0].style.height = (d.height-paddingSize)+"px";		
	
		var maximizedHeight = 2*d.height+heightBetweenNotes;
		
		rules.maximized[0].style.height = maximizedHeight + "px";
		rules.maximizedEditor[0].style.height = maximizedHeight - paddingSize +"px";
		rules.maximizedEditorParent[0].style.height = maximizedHeight - paddingSize + "px";
	},
	bigger:function(){
		this.setNoteSize(this.noteSize+1);
		ViewPreferences.setPreference("size",this.noteSize);
	},
	smaller:function(){
		this.setNoteSize(this.noteSize-1);
		ViewPreferences.setPreference("size",this.noteSize);
	},
	
	/*
	 * This is the padding and margins of all parent elements
	 * of the iframe, up until the first .note class. This allows us to give
	 * the iframe a precise height without triggering overflow
	 */
	notePaddingHeight:function(parent){
		var child;
		var height = 0;
		do{
			child=parent.getFirst();
			height+=this.sumProperties(child,"padding-top","padding-bottom","margin-top","margin-bottom");
			parent=child;
		}while(!child.className.contains("titlebar"));
		
		// once we we hit the titlebar element, add up all of the siblings
		// to the .editor (iframe) element
		var titlebar = child;
		var divider = titlebar.getNext();
		height+= titlebar.getStyle("height").toInt() + 
			this.sumProperties(divider,"height","margin-top","margin-bottom");
		
		return height;
	},
	/*
	 * Sums the values of css properties. "Auto" (IE's default for margins) gets
	 * converted to 0.
	 */
	sumProperties:function(){
		var sum=0, a=arguments, el = a[0];
		for (var i=1;i<arguments.length;i++){
			var v = el.getStyle(arguments[i]);
			sum+= ((v=="auto") ? 0 : v.toInt());
		}
		return sum;
	}
};


StretchyGrid.noteDimensions=function(noteSize){
	var d={};	
	// Multiplies for width and height growth
	var widthMulti=1.04;
	var heightMulti=1.03;
	d.width = Math.floor(Math.pow(widthMulti,noteSize) * noteSize * 45 +50);

	// Notes should always be a little bit shorter (15px), and their height should not grow as fast
	d.height = Math.floor(Math.pow(heightMulti,noteSize) * noteSize * 45 +40);

	return d;
};