import { AccountingEntry } from "@/api/entities";
import { ChartOfAccount } from "@/api/entities";
import { Transaction } from "@/api/entities";

export class AccountingService {
  
  // Ensure VAT accounts exist in chart of accounts
  static async ensureVATAccounts() {
    try {
      const chartAccounts = await ChartOfAccount.list();
      const vatReceivableExists = chartAccounts.some(acc => acc.account_code === "VAT001");
      const vatPayableExists = chartAccounts.some(acc => acc.account_code === "VAT002");

      // Create VAT Receivable account if it doesn't exist
      if (!vatReceivableExists) {
        await ChartOfAccount.create({
          account_code: "VAT001",
          account_name: "VAT Receivable",
          account_type: "Assets",
          account_group: "VAT",
          description: "VAT recoverable on purchases"
        });
        console.log("Created VAT Receivable account (VAT001)");
      }

      // Create VAT Payable account if it doesn't exist
      if (!vatPayableExists) {
        await ChartOfAccount.create({
          account_code: "VAT002",
          account_name: "VAT Payable",
          account_type: "Liabilities",
          account_group: "VAT",
          description: "VAT payable on sales"
        });
        console.log("Created VAT Payable account (VAT002)");
      }

    } catch (error) {
      console.error("Error ensuring VAT accounts exist:", error);
      // Don't throw error if it's just a network issue
      if (!error.message || !error.message.includes('Network Error')) {
        throw error;
      }
    }
  }

  static async createDoubleEntry({
    case_id,
    transaction_id,
    transaction_date,
    description,
    net_amount,
    vat_amount,
    gross_amount,
    transaction_type,
    account_code,
    bankAccountCode,
    reference
  }) {
    try {
      console.log("Creating double entry for:", { 
        case_id, 
        transaction_id, 
        account_code, 
        bankAccountCode, 
        gross_amount, 
        transaction_type,
        transaction_date 
      });

      // Validate required parameters
      if (!case_id || !transaction_id || !account_code || !bankAccountCode || !transaction_date) {
        const missing = [];
        if (!case_id) missing.push('case_id');
        if (!transaction_id) missing.push('transaction_id');
        if (!account_code) missing.push('account_code');
        if (!bankAccountCode) missing.push('bankAccountCode');
        if (!transaction_date) missing.push('transaction_date');
        throw new Error(`Missing required parameters: ${missing.join(', ')}`);
      }

      // Ensure VAT accounts exist before creating entries
      await this.ensureVATAccounts();

      // Get account details from chart of accounts
      const chartAccounts = await ChartOfAccount.list();
      const account = chartAccounts.find(acc => acc.account_code === account_code);
      const bankAccount = chartAccounts.find(acc => acc.account_code === bankAccountCode);
      const vatReceivableAccount = chartAccounts.find(acc => acc.account_code === 'VAT001');
      const vatPayableAccount = chartAccounts.find(acc => acc.account_code === 'VAT002');
      
      if (!account) {
        throw new Error(`Account code ${account_code} not found in chart of accounts`);
      }
      if (!bankAccount) {
        throw new Error(`Bank account with code ${bankAccountCode} not found in chart of accounts`);
      }
      if (!vatReceivableAccount || !vatPayableAccount) {
        throw new Error('VAT accounts (VAT001, VAT002) not found in Chart of Accounts. Please ensure they are set up in Settings.');
      }

      const entries = [];
      const entryDate = transaction_date;
      const grossAmountNum = parseFloat(gross_amount) || 0;
      const netAmountNum = parseFloat(net_amount) || 0;
      const vatAmountNum = parseFloat(vat_amount) || 0;

      console.log("Creating entries with amounts:", { grossAmountNum, netAmountNum, vatAmountNum });

      if (transaction_type === 'receipt') {
        // Receipt: Debit Bank Account, Credit the specified account (and VAT if applicable)
        
        // 1. Debit Bank Account (full gross amount)
        entries.push({
          case_id: case_id,
          transaction_id: transaction_id,
          entry_date: entryDate,
          account_code: bankAccount.account_code,
          account_name: bankAccount.account_name,
          account_type: bankAccount.account_type || "Assets",
          account_group: bankAccount.account_group || "Bank Accounts",
          description: `Receipt: ${description}`,
          debit_amount: grossAmountNum,
          credit_amount: 0,
          reference: reference || transaction_id,
          journal_type: "receipts"
        });

        // 2. Credit the specified account (net amount if VAT present, gross if no VAT)
        const creditAmount = vatAmountNum > 0 ? netAmountNum : grossAmountNum;
        entries.push({
          case_id: case_id,
          transaction_id: transaction_id,
          entry_date: entryDate,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type || "Revenue",
          account_group: account.account_group || "Sales",
          description: `Receipt: ${description}`,
          debit_amount: 0,
          credit_amount: creditAmount,
          reference: reference || transaction_id,
          journal_type: "receipts"
        });

        // 3. Credit VAT Payable if VAT present
        if (vatAmountNum > 0) {
          entries.push({
            case_id: case_id,
            transaction_id: transaction_id,
            entry_date: entryDate,
            account_code: vatPayableAccount.account_code,
            account_name: vatPayableAccount.account_name,
            account_type: vatPayableAccount.account_type,
            account_group: vatPayableAccount.account_group,
            description: `VAT on receipt: ${description}`,
            debit_amount: 0,
            credit_amount: vatAmountNum,
            reference: reference || transaction_id,
            journal_type: "receipts"
          });
        }

      } else if (transaction_type === 'payment') {
        // Payment: Credit Bank Account, Debit the specified account (and VAT if applicable)
        
        // 1. Credit Bank Account (full gross amount)
        entries.push({
          case_id: case_id,
          transaction_id: transaction_id,
          entry_date: entryDate,
          account_code: bankAccount.account_code,
          account_name: bankAccount.account_name,
          account_type: bankAccount.account_type || "Assets",
          account_group: bankAccount.account_group || "Bank Accounts",
          description: `Payment: ${description}`,
          debit_amount: 0,
          credit_amount: grossAmountNum,
          reference: reference || transaction_id,
          journal_type: "payments"
        });

        // 2. Debit the specified account (net amount if VAT present, gross if no VAT)
        const debitAmount = vatAmountNum > 0 ? netAmountNum : grossAmountNum;
        entries.push({
          case_id: case_id,
          transaction_id: transaction_id,
          entry_date: entryDate,
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type || "Expenses",
          account_group: account.account_group || "General Expenses",
          description: `Payment: ${description}`,
          debit_amount: debitAmount,
          credit_amount: 0,
          reference: reference || transaction_id,
          journal_type: "payments"
        });

        // 3. Debit VAT Receivable if VAT present
        if (vatAmountNum > 0) {
          entries.push({
            case_id: case_id,
            transaction_id: transaction_id,
            entry_date: entryDate,
            account_code: vatReceivableAccount.account_code,
            account_name: vatReceivableAccount.account_name,
            account_type: vatReceivableAccount.account_type,
            account_group: vatReceivableAccount.account_group,
            description: `VAT on payment: ${description}`,
            debit_amount: vatAmountNum,
            credit_amount: 0,
            reference: reference || transaction_id,
            journal_type: "payments"
          });
        }
      }

      // Create all entries with better error handling
      console.log("About to create accounting entries:", entries);
      
      const createdEntries = [];
      for (const entry of entries) {
        try {
          const createdEntry = await AccountingEntry.create(entry);
          createdEntries.push(createdEntry);
          console.log("Created accounting entry:", createdEntry);
        } catch (entryError) {
          console.error("Failed to create individual entry:", entry, entryError);
          
          // If it's a network error, throw a more specific message
          if (entryError.message && entryError.message.includes('Network Error')) {
            throw new Error(`Network error creating accounting entry. Please check your connection and try again.`);
          }
          
          throw new Error(`Failed to create accounting entry: ${entryError.message}`);
        }
      }

      console.log(`Successfully created ${createdEntries.length} accounting entries for transaction ${transaction_id}`);
      return createdEntries;

    } catch (error) {
      console.error("Error in createDoubleEntry:", error);
      
      // Provide more specific error messages for network issues
      if (error.message && error.message.includes('Network Error')) {
        throw new Error(`Network connection issue while creating accounting entries. Please check your internet connection and try again.`);
      }
      
      throw new Error(`Error creating double entry: ${error.message}`);
    }
  }

  static async deleteTransactionEntries(transactionId) {
    try {
      console.log("Deleting accounting entries for transaction:", transactionId);
      
      // Get all entries for this transaction with error handling
      let entries = [];
      try {
        entries = await AccountingEntry.filter({ transaction_id: transactionId });
      } catch (filterError) {
        console.error("Error fetching entries to delete:", filterError);
        if (filterError.message && filterError.message.includes('Network Error')) {
          throw new Error('Network error while fetching entries to delete. Please check your connection.');
        }
        throw filterError;
      }
      
      // Delete each entry
      const deletePromises = entries.map(entry => AccountingEntry.delete(entry.id));
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted ${entries.length} accounting entries for transaction ${transactionId}`);
      return entries.length;
      
    } catch (error) {
      console.error("Error deleting transaction entries:", error);
      
      if (error.message && error.message.includes('Network Error')) {
        throw new Error(`Network error while deleting accounting entries. Please check your connection and try again.`);
      }
      
      throw new Error(`Failed to delete accounting entries: ${error.message}`);
    }
  }

  static async cleanupOrphanedEntries(caseId) {
    try {
      console.log("Cleaning up orphaned accounting entries for case:", caseId);
      
      // Get all accounting entries for this case with error handling
      let entries = [];
      try {
        entries = await AccountingEntry.filter({ case_id: caseId });
      } catch (entriesError) {
        console.error("Error fetching accounting entries:", entriesError);
        if (entriesError.message && entriesError.message.includes('Network Error')) {
          console.warn("Network error fetching accounting entries, skipping cleanup");
          return 0;
        }
        throw entriesError;
      }
      
      // Get all transactions for this case with error handling
      let transactions = [];
      try {
        const { Transaction } = await import('@/api/entities');
        transactions = await Transaction.filter({ case_id: caseId });
      } catch (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
        if (transactionsError.message && transactionsError.message.includes('Network Error')) {
          console.warn("Network error fetching transactions, skipping cleanup");
          return 0;
        }
        throw transactionsError;
      }
      
      const transactionIds = new Set(transactions.map(t => t.id));
      
      // Find orphaned entries (entries that reference non-existent transactions)
      const orphanedEntries = entries.filter(entry => 
        entry.transaction_id && !transactionIds.has(entry.transaction_id)
      );
      
      if (orphanedEntries.length > 0) {
        console.log(`Found ${orphanedEntries.length} orphaned accounting entries, deleting...`);
        
        // Delete orphaned entries
        const deletePromises = orphanedEntries.map(entry => AccountingEntry.delete(entry.id));
        await Promise.all(deletePromises);
        
        console.log(`Successfully cleaned up ${orphanedEntries.length} orphaned accounting entries`);
      } else {
        console.log("No orphaned accounting entries found");
      }
      
      return orphanedEntries.length;
      
    } catch (error) {
      console.error("Error cleaning up orphaned entries:", error);
      
      if (error.message && error.message.includes('Network Error')) {
        console.warn("Network error during cleanup, continuing without cleanup");
        return 0; // Return 0 instead of throwing to allow operation to continue
      }
      
      throw new Error(`Failed to cleanup orphaned entries: ${error.message}`);
    }
  }

  static async getTrialBalance(caseId, selectedAccount = 'all') {
    try {
      console.log("Getting trial balance for case:", caseId, "Account filter:", selectedAccount);
      
      let entries = [];
      let chartOfAccounts = [];
      let transactions = [];
      
      try {
        [entries, chartOfAccounts, transactions] = await Promise.all([
          AccountingEntry.filter({ case_id: caseId }),
          ChartOfAccount.list(),
          Transaction.filter({ case_id: caseId })
        ]);
      } catch (fetchError) {
        console.error("Error fetching data for trial balance:", fetchError);
        
        if (fetchError.message && fetchError.message.includes('Network Error')) {
          throw new Error('Network connection issue loading trial balance data. Please check your internet connection and try again.');
        }
        
        throw new Error(`Failed to fetch trial balance data: ${fetchError.message}`);
      }
      
      console.log("Found accounting entries:", entries.length);
      console.log("Found transactions:", transactions.length);
      console.log("Found chart of accounts:", chartOfAccounts.length);

      // Filter to only approved transactions
      let approvedTransactions = transactions.filter(tx => tx.status === 'approved');
      
      // Apply bank account filter if not 'all'
      if (selectedAccount !== 'all') {
        approvedTransactions = approvedTransactions.filter(tx => {
          // If target_account is not set, treat it as 'primary' (default)
          const txAccount = tx.target_account || 'primary';
          return txAccount === selectedAccount;
        });
        console.log(`Filtered to ${approvedTransactions.length} transactions for account: ${selectedAccount}`);
        console.log('Sample filtered transactions:', approvedTransactions.slice(0, 3).map(t => ({
          id: t.id,
          target_account: t.target_account,
          description: t.description
        })));
      }
      
      const approvedTransactionIds = new Set(approvedTransactions.map(tx => tx.id));

      console.log("Approved transaction IDs (after account filter):", approvedTransactionIds.size);

      // Filter entries to only include those from approved transactions (and adjusting entries like VAT allocations)
      const approvedEntries = entries.filter(entry => 
        entry.journal_type === 'adjusting' || (entry.transaction_id && approvedTransactionIds.has(entry.transaction_id))
      );

      console.log("Entries from approved transactions (including adjusting entries):", approvedEntries.length);

      if (approvedEntries.length === 0) {
        return [];
      }

      // Group by account code and calculate balances from approved entries only
      const accountBalances = {};
      approvedEntries.forEach(entry => {
        const accountCode = entry.account_code;
        if (!accountBalances[accountCode]) {
          accountBalances[accountCode] = {
            total_debits: 0,
            total_credits: 0
          };
        }
        accountBalances[accountCode].total_debits += parseFloat(entry.debit_amount) || 0;
        accountBalances[accountCode].total_credits += parseFloat(entry.credit_amount) || 0;
      });

      // Combine with Chart of Accounts to get full details and calculate net balance
      const result = Object.keys(accountBalances).map(accountCode => {
        const accountInfo = chartOfAccounts.find(acc => acc.account_code === accountCode);
        const balanceInfo = accountBalances[accountCode];

        if (!accountInfo) {
          console.warn(`Account code ${accountCode} found in entries but not in Chart of Accounts. Skipping.`);
          return null;
        }

        const netBalance = balanceInfo.total_debits - balanceInfo.total_credits;
        
        return {
          ...accountInfo,
          net_balance: netBalance
        };
      })
      .filter(account => account && Math.abs(account.net_balance) >= 0.01);

      console.log("Calculated trial balance (approved only):", result);
      return result;

    } catch (error) {
      console.error("Error getting trial balance:", error);
      
      if (error.message && error.message.includes('Network Error')) {
        throw new Error('Network connection issue loading trial balance. Please check your internet connection and try again.');
      }
      
      throw new Error(`Failed to load trial balance: ${error.message}`);
    }
  }

  static async getDebugInfo(caseId) {
    try {
      const entries = await AccountingEntry.filter({ case_id: caseId });
      const allEntries = await AccountingEntry.list();
      
      return {
        entriesForCase: entries.length,
        totalEntries: allEntries.length,
        sampleEntries: entries.slice(0, 3),
        caseId: caseId
      };
    } catch (error) {
      console.error("Error getting debug info:", error);
      return { 
        error: error.message,
        networkError: error.message && error.message.includes('Network Error')
      };
    }
  }
}