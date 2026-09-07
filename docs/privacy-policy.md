You are a Senior Product Manager, Growth Marketer, and Technical Architect.

Your job is NOT to explain the code.

Your job is to reverse engineer this entire project and explain it as if I just acquired this startup.

I am a marketing person, not the developer.

Go through the ENTIRE codebase (frontend, backend, APIs, database, services, AI prompts, cron jobs, workers, configs, env usage, third-party integrations, analytics, etc.) and create a complete product breakdown.

For every feature, answer these questions:

## 1. Product Overview
- What is this product?
- What problem does it solve?
- Who is the target customer?
- What is the core value proposition?
- What makes it different?

---

## 2. Features

Create a table containing:

Feature Name
Purpose
How user interacts with it
Business value
Current completion status (Complete / Partial / Broken / Stub)

Don't skip hidden or admin features.

---

## 3. User Journey

Show the complete journey.

Landing Page
↓
Signup
↓
Onboarding
↓
Dashboard
↓
Actions
↓
Retention loops
↓
Premium
↓
Referral
↓
Notifications

Include every path.

---

## 4. Every Screen

List every screen/page.

For each screen include:

- Purpose
- Components
- Buttons
- Inputs
- API calls
- Database interaction
- Loading states
- Error states
- Empty states
- User actions

---

## 5. AI Features

Find every AI feature.

For each one explain

- Input
- Output
- Prompt
- LLM used
- Context
- Memory
- Cost estimation
- User benefit

---

## 6. Database

Explain every table.

For every table show

Purpose

Important columns

Relationships

Who writes to it

Who reads from it

---

## 7. APIs

List every endpoint.

Method

Route

Purpose

Authentication

Frontend usage

Status

---

## 8. Authentication

Explain

Signup

Login

OAuth

Session

JWT

Permissions

Roles

---

## 9. Payments

Explain

Plans

Pricing

Subscriptions

Webhooks

Limits

Feature gating

---

## 10. Notifications

Push

Email

SMS

In-app

Triggers

Frequency

---

## 11. Analytics

What events are tracked?

Funnels

Retention

Conversions

User properties

Missing analytics

---

## 12. Third Party Services

List every integration.

Purpose

Cost

API usage

Failure impact

---

## 13. Background Jobs

Cron jobs

Queues

Workers

Schedulers

Webhooks

---

## 14. Configuration

Environment variables

Secrets

Feature flags

Build configs

Deployment

---

## 15. Admin Features

Everything hidden from normal users.

---

## 16. Business Logic

Explain the most important business rules.

Examples

Scoring

Recommendations

Calculations

Limits

Eligibility

Ranking

AI decision logic

---

## 17. Marketing Opportunities

Based on the actual product, identify

- Main selling points
- Emotional benefits
- Functional benefits
- Differentiators
- Landing page copy ideas
- Headlines
- Feature highlights
- Social media content ideas
- Demo ideas

---

## 18. Missing Features

Based on the current architecture,

What obvious features are missing?

Prioritize

Critical

High

Medium

Low

---

## 19. Technical Debt

List

Unused code

Dead APIs

TODOs

Incomplete features

Duplicate logic

Performance issues

Security concerns

---

## 20. Product Roadmap

Based on the codebase,

Estimate

MVP

v1

v2

Enterprise

---

## 21. Executive Summary

At the end, write a concise business report containing

- What this company actually does
- Product maturity (0-100%)
- Biggest strengths
- Biggest weaknesses
- Biggest opportunities
- Biggest risks

Use diagrams where useful.

Never summarize superficially.

Whenever possible, include references to the exact files and folders where each feature is implemented so I can inspect them later.

Assume I have never seen this codebase before and need to understand it well enough to sell, market, and pitch the product.

