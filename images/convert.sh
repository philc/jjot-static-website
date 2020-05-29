#converts pngs to gifs, where needed

convert buttons.png -background "#F8EED6" -flatten -transparent "#F8EED6" buttons.gif 2> /dev/null
# we're exporting at 4x the size of the image (360dpi). Resize it.
# we need to detect the size of the all.png and reduce it by 4, instead of hard coding this size
convert -adaptive-resize 135x411 all.png all3.png
convert all.png all.gif 2> /dev/null
convert messages-corners.png messages-corners.gif 2> /dev/null