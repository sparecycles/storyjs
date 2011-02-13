# == Schema Information
#
# Table name: transactions
#
#  id                    :integer         not null, primary key
#  amount                :decimal(10, 2)
#  client_id             :integer
#  data                  :text
#  client_data           :text
#  parent_transaction_id :integer
#  transacted_at         :datetime
#  created_at            :datetime
#  updated_at            :datetime
#

class Transaction < ActiveRecord::Base
  belongs_to :parent_transaction, :class_name => :transaction
  belongs_to :client
end

# vim: set sw=2 ts=2 expandtab :
