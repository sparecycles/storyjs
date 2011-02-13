require 'test_helper'

class TransactionTest < ActiveSupport::TestCase
  # Replace this with your real tests.
  test "the truth" do
    assert true
  end
end

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

