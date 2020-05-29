#!/usr/bin/env ruby

#converts pngs to gifs, where needed

# `convert buttons.png -background "#F8EED6" -flatten -transparent "#F8EED6" buttons.gif 2> /dev/null`
# # we're exporting at 4x the size of the image (360dpi). Resize it.
# # we need to detect the size of the all.png and reduce it by 4, instead of hard coding this size
# convert -adaptive-resize 135x411 all.png all3.png
# convert all.png all.gif 2> /dev/null
# convert messages-corners.png messages-corners.gif 2> /dev/null


def image_size(path)
  o=`file #{path}`
  o.match(/\b(\d+)\s*x\s*(\d+)\b/)
  return {:width=>$1.to_i, :height=>$2.to_i}
end

def resize4(file, file2)
  f = image_size(file)
  w = (f[:width]/4).round
  h = (f[:height]/4).round
  puts "running",   "convert -adaptive-resize #{w}x#{h} #{file} #{file2}"
  `convert -adaptive-resize #{w}x#{h} #{file} #{file2}`
end

`convert buttons.png -background "#F8EED6" -flatten -transparent "#F8EED6" buttons.gif 2> /dev/null`

# resize4("all.png", "all.gif")

# resize4("print-logo.png", "print-logo.png")
# # we're exporting at 4x the size of the image (360dpi). Resize it.
# # we need to detect the size of the all.png and reduce it by 4, instead of hard coding this size
# convert -adaptive-resize 135x411 all.png all3.png

# convert all.png all.gif 2> /dev/null
# convert messages-corners.png messages-corners.gif 2> /dev/null