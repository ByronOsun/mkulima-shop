import { useEffect, useMemo, useState } from 'react';
import { FinanceExpense, FinanceExpenseCategory, Sale } from '../types';
import { supabaseService } from '../services/supabase';
import '../styles/FinancePage.css';

const expenseCategories: { value: FinanceExpenseCategory; label: string }[] = [
  { value: 'salaries', label: 'Salaries' },
  { value: 'rent', label: 'Rent' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'investment', label: 'Investment' },
  { value: 'others', label: 'Others' },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(value);

const getMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
};

const getToday = () => new Date().toISOString().split('T')[0];

export default function FinancePage() {
  const [startDate, setStartDate] = useState(getMonthStart());
  const [endDate, setEndDate] = useState(getToday());
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    expense_date: getToday(),
    category: 'salaries' as FinanceExpenseCategory,
    description: '',
    amount: '',
  });

  useEffect(() => {
    void loadFinanceData();
  }, [startDate, endDate]);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, expensesData] = await Promise.all([
        supabaseService.getSalesBetweenDates(startDate, endDate),
        supabaseService.getFinanceExpenses(startDate, endDate),
      ]);
      setSales(salesData);
      setExpenses(expensesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  const revenue = useMemo(() => sales.reduce((sum, sale) => sum + sale.total_amount, 0), [sales]);

  const expenseTotals = useMemo(() => {
    const categoryTotals = expenseCategories.reduce(
      (acc, category) => {
        acc[category.value] = 0;
        return acc;
      },
      {} as Record<FinanceExpenseCategory, number>
    );

    for (const expense of expenses) {
      categoryTotals[expense.category] += expense.amount;
    }

    return categoryTotals;
  }, [expenses]);

  const totalExpenses = useMemo(
    () => Object.values(expenseTotals).reduce((sum, amount) => sum + amount, 0),
    [expenseTotals]
  );

  const profit = revenue - totalExpenses;

  const handleExpenseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number(expenseForm.amount);
    if (!expenseForm.description.trim()) {
      setError('Expense description is required');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Expense amount must be greater than zero');
      return;
    }
    if (expenseForm.expense_date < startDate || expenseForm.expense_date > endDate) {
      setError('Expense date must fall within the selected financial period');
      return;
    }

    try {
      setSavingExpense(true);
      setError(null);
      setMessage(null);
      await supabaseService.addFinanceExpense({
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        description: expenseForm.description.trim(),
        amount,
      });
      setExpenseForm({
        expense_date: expenseForm.expense_date,
        category: 'salaries',
        description: '',
        amount: '',
      });
      setMessage('Expense added successfully.');
      await loadFinanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      setError(null);
      setMessage(null);
      await supabaseService.deleteFinanceExpense(expenseId);
      setMessage('Expense removed.');
      await loadFinanceData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
    }
  };

  if (loading) {
    return <div className="page-loader">Loading finance data...</div>;
  }

  return (
    <div className="finance-page">
      <div className="finance-header">
        <div>
          <h2>Finance</h2>
          <p>Track revenue, expenses, and profit for a selected financial period.</p>
        </div>

        <div className="period-controls">
          <label>
            Start Date
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End Date
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}

      <div className="finance-summary">
        <div className="finance-card accent-revenue">
          <span className="finance-label">Revenue</span>
          <strong>{formatMoney(revenue)}</strong>
          <small>{sales.length} transactions</small>
        </div>
        <div className="finance-card accent-expenses">
          <span className="finance-label">Expenses</span>
          <strong>{formatMoney(totalExpenses)}</strong>
          <small>{expenses.length} entries</small>
        </div>
        <div className={`finance-card ${profit >= 0 ? 'accent-profit' : 'accent-loss'}`}>
          <span className="finance-label">Profit</span>
          <strong>{formatMoney(profit)}</strong>
          <small>{profit >= 0 ? 'Positive margin' : 'Loss for period'}</small>
        </div>
      </div>

      <div className="finance-grid">
        <section className="finance-panel">
          <div className="panel-header">
            <h3>Expense Entry</h3>
            <p>Insert period expenses by category.</p>
          </div>

          <form className="expense-form" onSubmit={handleExpenseSubmit}>
            <label>
              Date
              <input
                type="date"
                value={expenseForm.expense_date}
                onChange={e => setExpenseForm(current => ({ ...current, expense_date: e.target.value }))}
              />
            </label>

            <label>
              Category
              <select
                value={expenseForm.category}
                onChange={e =>
                  setExpenseForm(current => ({
                    ...current,
                    category: e.target.value as FinanceExpenseCategory,
                  }))
                }
              >
                {expenseCategories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Description
              <input
                type="text"
                placeholder="Enter expense description"
                value={expenseForm.description}
                onChange={e => setExpenseForm(current => ({ ...current, description: e.target.value }))}
              />
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(current => ({ ...current, amount: e.target.value }))}
              />
            </label>

            <button className="finance-btn" type="submit" disabled={savingExpense}>
              {savingExpense ? 'Saving...' : 'Add Expense'}
            </button>
          </form>
        </section>

        <section className="finance-panel">
          <div className="panel-header">
            <h3>Expense Breakdown</h3>
            <p>Totals by category for the selected period.</p>
          </div>

          <div className="category-breakdown">
            {expenseCategories.map(category => (
              <div key={category.value} className="category-row">
                <span>{category.label}</span>
                <strong>{formatMoney(expenseTotals[category.value])}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="finance-grid full-width">
        <section className="finance-panel">
          <div className="panel-header">
            <h3>Recorded Expenses</h3>
            <p>Expenses filtered to the financial period.</p>
          </div>

          <div className="expense-list">
            {expenses.length === 0 ? (
              <p className="empty-state">No expenses recorded in this period.</p>
            ) : (
              expenses.map(expense => (
                <div key={expense.id} className="expense-row">
                  <div className="expense-meta">
                    <strong>{expense.description}</strong>
                    <span>
                      {expense.expense_date} • {expense.category}
                    </span>
                  </div>
                  <div className="expense-actions">
                    <span className="expense-amount">{formatMoney(expense.amount)}</span>
                    <button
                      type="button"
                      className="expense-delete"
                      onClick={() => handleDeleteExpense(expense.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
