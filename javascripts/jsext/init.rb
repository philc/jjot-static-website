require 'jsext'
# require 'asset_tag_helper_extensions'

# make plugin controllers and views available to app
config.load_paths += %W(#{JSExt::PLUGIN_CONTROLLER_PATH})
Rails::Initializer.run(:set_load_path, config)

# add methods to action controller base
# ActionController::Base.send(:include, JSExtras::ControllerMethods)

# load in the helpers and caching code
# ActionController::Base.send(:helper, UJS::Helpers)
# ActionController::Base.send(:include, UJS::BehaviourCaching)

# require the controller
require 'jsext_controller'