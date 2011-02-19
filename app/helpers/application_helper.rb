# Methods added to this helper will be available to all templates in the application.
module ApplicationHelper
  def uses feat
    @features ||= {}
	return unless not @features.has_key?(feat.to_sym)
    @features[feat] = true
    print(capture do  
      render(:partial => feat.to_s)
    end)
  end
end
