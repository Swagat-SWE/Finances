import type { Account, Category, Transaction } from './models'

export const accounts: Account[] = [
  { id: 'chase', institution: 'Chase', displayName: 'Chase card', type: 'credit', lastFour: '3491', color: '#355bdb', active: true },
  { id: 'amex', institution: 'American Express', displayName: 'Blue Cash Everyday', type: 'credit', lastFour: '5401', color: '#cc9b35', active: true },
  { id: 'capital', institution: 'Capital One', displayName: 'Savor', type: 'credit', lastFour: '1234', color: '#e45357', active: true },
  { id: 'apple', institution: 'Apple', displayName: 'Apple Card', type: 'credit', lastFour: '3481', color: '#5865f2', active: true },
  { id: 'discover', institution: 'Discover', displayName: 'Discover card', type: 'credit', lastFour: '3204', color: '#ef7b35', active: true },
  { id: 'ally', institution: 'Ally', displayName: 'Everyday Checking', type: 'debit', lastFour: '8290', color: '#287c74', active: true },
]

export const categories: Category[] = [
  { id: 'food', name: 'Food & Dining', color: '#ea7553', subcategories: ['Restaurants', 'Coffee', 'Delivery', 'Fast Food'] },
  { id: 'groceries', name: 'Groceries', color: '#75a86f', subcategories: ['Supermarkets', 'Specialty Food'] },
  { id: 'transport', name: 'Transportation', color: '#5a9fc5', subcategories: ['Rideshare', 'Fuel', 'Transit'] },
  { id: 'shopping', name: 'Shopping', color: '#ad7cc5', subcategories: ['Online', 'Retail', 'Electronics'] },
  { id: 'travel', name: 'Travel', color: '#4f85c9', subcategories: ['Flights', 'Hotels', 'Car Rental'] },
  { id: 'bills', name: 'Bills & Utilities', color: '#d5a65b', subcategories: ['Utilities', 'Phone', 'Internet'] },
  { id: 'entertainment', name: 'Entertainment', color: '#ca6d95', subcategories: ['Streaming', 'Events', 'Games'] },
  { id: 'health', name: 'Healthcare', color: '#5aa99e', subcategories: ['Pharmacy', 'Medical'] },
  { id: 'fees', name: 'Fees & Adjustments', color: '#b18a63', subcategories: ['Fees', 'Interest'] },
  { id: 'other', name: 'Other', color: '#9a98a5', subcategories: ['Miscellaneous', 'Services'] },
]

export const transactions: Transaction[] = [
  { id: 't1', accountId: 'capital', statementId: 'st1', transactionDate: '2026-08-14', merchantRaw: 'DUNKIN #0421', merchantNormalized: 'Dunkin', description: 'DUNKIN #0421 CHICAGO IL', amount: 12.43, currency: 'USD', categoryId: 'food', subcategory: 'Coffee', transactionType: 'purchase', sourceFile: 'capital-one-august.pdf', confidence: .98 },
  { id: 't2', accountId: 'amex', statementId: 'st2', transactionDate: '2026-08-13', merchantRaw: 'AMAZON MARKETPLACE', merchantNormalized: 'Amazon', description: 'AMAZON MARKETPLACE', amount: 87.22, currency: 'USD', categoryId: 'shopping', subcategory: 'Online', transactionType: 'purchase', sourceFile: 'amex-august.pdf', confidence: .96 },
  { id: 't3', accountId: 'chase', statementId: 'st3', transactionDate: '2026-08-12', merchantRaw: 'UBER TRIP', merchantNormalized: 'Uber', description: 'UBER TRIP HELP.UBER.COM', amount: 24.13, currency: 'USD', categoryId: 'transport', subcategory: 'Rideshare', transactionType: 'purchase', sourceFile: 'chase-august.pdf', confidence: .99 },
  { id: 't4', accountId: 'apple', statementId: 'st4', transactionDate: '2026-08-11', merchantRaw: 'WHOLE FOODS', merchantNormalized: 'Whole Foods', description: 'WHOLE FOODS MARKET', amount: 64.91, currency: 'USD', categoryId: 'groceries', subcategory: 'Supermarkets', transactionType: 'purchase', sourceFile: 'apple-card-august.csv', confidence: .99 },
  { id: 't5', accountId: 'amex', statementId: 'st2', transactionDate: '2026-08-10', merchantRaw: 'UNITED AIRLINES', merchantNormalized: 'United Airlines', description: 'UNITED AIRLINES TICKET', amount: 418.38, currency: 'USD', categoryId: 'travel', subcategory: 'Flights', transactionType: 'purchase', sourceFile: 'amex-august.pdf', confidence: .99 },
  { id: 't6', accountId: 'chase', statementId: 'st3', transactionDate: '2026-08-09', merchantRaw: 'NETFLIX.COM', merchantNormalized: 'Netflix', description: 'NETFLIX.COM', amount: 22.99, currency: 'USD', categoryId: 'entertainment', subcategory: 'Streaming', transactionType: 'purchase', sourceFile: 'chase-august.pdf', confidence: .99 },
  { id: 't7', accountId: 'discover', statementId: 'st5', transactionDate: '2026-08-08', merchantRaw: 'TARGET', merchantNormalized: 'Target', description: 'TARGET 000134', amount: 126.45, currency: 'USD', categoryId: 'shopping', subcategory: 'Retail', transactionType: 'purchase', sourceFile: 'discover-august.pdf', confidence: .98 },
  { id: 't8', accountId: 'ally', statementId: 'st6', transactionDate: '2026-08-07', merchantRaw: 'COMED', merchantNormalized: 'ComEd', description: 'COMED PAYMENT', amount: 145.2, currency: 'USD', categoryId: 'bills', subcategory: 'Utilities', transactionType: 'purchase', sourceFile: 'ally-august.pdf', confidence: .92 },
  { id: 't9', accountId: 'capital', statementId: 'st1', transactionDate: '2026-08-06', merchantRaw: 'DUNKIN #0142', merchantNormalized: 'Dunkin', description: 'DUNKIN #0142 CHICAGO IL', amount: 8.78, currency: 'USD', categoryId: 'food', subcategory: 'Coffee', transactionType: 'purchase', sourceFile: 'capital-one-august.pdf', confidence: .98 },
  { id: 't10', accountId: 'amex', statementId: 'st2', transactionDate: '2026-08-05', merchantRaw: 'APPLE.COM/BILL', merchantNormalized: 'Apple', description: 'APPLE.COM/BILL', amount: 182.1, currency: 'USD', categoryId: 'shopping', subcategory: 'Electronics', transactionType: 'purchase', sourceFile: 'amex-august.pdf', confidence: .97 },
]

export const trendData = [{ label: 'Jan', amount: 965 }, { label: 'Feb', amount: 1240 }, { label: 'Mar', amount: 1095 }, { label: 'Apr', amount: 1480 }, { label: 'May', amount: 1175 }, { label: 'Jun', amount: 1610 }, { label: 'Jul', amount: 1380 }, { label: 'Aug', amount: 1840 }]
