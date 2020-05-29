class JavascriptsController < ApplicationController
  before_filter :set_headers
  session :off
  layout nil

  def index
    render :file=>"vendor/plugins/javascripts/lib/"+params[:jsfile].to_s
  end

  private
  def set_headers
    headers['Content-Type'] = 'text/javascript; charset=utf-8'
  end
end
