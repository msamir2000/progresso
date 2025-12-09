import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChartOfAccount } from "@/api/entities";

export default function AccountCodeSelect({ value, onValueChange }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAccounts = async () => {
      setIsLoading(true);
      try {
        const accountList = await ChartOfAccount.list();
        // Ensure we have valid account data
        const validAccounts = (accountList || []).filter(account => 
          account && 
          typeof account === 'object' && 
          account.account_code && 
          account.account_name
        );
        setAccounts(validAccounts);
      } catch (error) {
        console.error("Failed to load chart of accounts:", error);
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadAccounts();
  }, []);

  const selectedAccount = accounts.find(
    (account) => account && account.account_code === value
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-11 border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white text-slate-900"
          disabled={isLoading}
        >
          {isLoading
            ? "Loading accounts..."
            : selectedAccount
            ? `${selectedAccount.account_name} (${selectedAccount.account_code})`
            : "Select account..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search by name or code..." />
          <CommandList>
            <CommandEmpty>
              {accounts.length === 0 
                ? "No accounts available. Please add accounts in Settings > Chart of Accounts." 
                : "No account found."
              }
            </CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => {
                // Ensure account has required properties
                if (!account || !account.account_code || !account.account_name) {
                  return null;
                }
                
                return (
                  <CommandItem
                    key={account.account_code}
                    value={`${account.account_name} ${account.account_code}`}
                    onSelect={() => {
                      if (onValueChange && account.account_code) {
                        onValueChange(account.account_code);
                      }
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === account.account_code ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <p className="font-medium">{account.account_name}</p>
                      <p className="text-xs text-slate-500">{account.account_code}</p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}