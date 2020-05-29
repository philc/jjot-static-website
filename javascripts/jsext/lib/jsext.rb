module JSExt
  PLUGIN_NAME = 'jsext'
  PLUGIN_PATH = "#{RAILS_ROOT}/vendor/plugins/#{PLUGIN_NAME}"
  PLUGIN_CONTROLLER_PATH = "#{PLUGIN_PATH}/lib/controllers"
  
  # Adds routes to your application necessary for the plugin to function correctly.
  # Simply add the following inside your Routes.draw block in routes.rb:
  #   JSExt::routes
  def self.routes
    ActionController::Routing::Routes.add_route "/jsext/*jsfile",
     :controller => "JSExt", :action => "index"
  end
end