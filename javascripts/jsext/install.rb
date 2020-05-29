#
# copy our controller file to the project's controller directory
#
require "FileUtils" unless defined? FileUtils

project_dir = File.dirname(__FILE__)+"/../../../"
controller =  File.dirname(__FILE__)+"/controller/javascripts_controller.rb"

controllers_dir=project_dir+"app/controllers/"

if FileTest.exists?(controllers_dir + "javascripts_controller.rb")
  puts "app/controller/javascripts_controller.rb already exists. Replace it? [N|y]"
  choice = gets.chomp.downcase
  return unless choice.index("y")==0
end

FileUtils.copy(controller, project_dir+"app/controllers/")


puts "Copied javascripts_controller.rb in /app/controllers/"
puts "\nAdd this to your config/routes.rb file:"
puts "map.connect '/javascripts/*jsfile', :controller => 'javascripts'  \n"
