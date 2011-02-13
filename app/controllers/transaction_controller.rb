class TransactionController < ApplicationController
  def transact
    Transaction
    params
  end
end

# vim: set sw=2 ts=2 expandtab :
