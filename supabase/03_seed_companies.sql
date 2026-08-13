-- =====================================================================
-- AI OUTCOME LEDGER — companies
-- Run this THIRD. Re-runnable.
--
-- NOTE ON cik: deliberately left null. The Worker resolves ticker -> CIK
-- from https://www.sec.gov/files/company_tickers.json on its first run
-- and writes it back. No CIK in this file was typed from memory, because
-- a wrong CIK silently pulls another company's financials.
-- =====================================================================

insert into companies (slug, name, ticker, stooq_symbol, sector, group_code, group_label, is_public, hq_country, notes) values

-- ---- C: platform vendors running their own AI internally ------------
('ibm','International Business Machines','IBM','ibm.us','Enterprise IT','C','Platform vendor dogfooding',true,'US',
 'Best-documented enterprise retrofit on record. Headcount rose while savings were claimed.'),
('servicenow','ServiceNow','NOW','now.us','Enterprise software','C','Platform vendor dogfooding',true,'US',
 '"Now on Now" internal program doubles as sales collateral.'),
('salesforce','Salesforce','CRM','crm.us','Enterprise software','C','Platform vendor dogfooding',true,'US',
 'Sits in Group C and Group J at once: capturing internal AI gains while its own seat-based pricing erodes.'),
('microsoft','Microsoft','MSFT','msft.us','Enterprise software','C','Platform vendor dogfooding',true,'US',
 'Claimed call-centre savings in the same year as large layoffs; attribution between the two is not disclosed.'),

-- ---- D: large incumbents and regulated enterprises -------------------
('jpmorgan','JPMorgan Chase','JPM','jpm.us','Banking','D','Large incumbent / regulated',true,'US',
 'The cleanest large-enterprise datapoint that exists, because the CEO stated cost and benefit in the same sentence.'),
('klarna','Klarna Group','KLAR','klar.us','Fintech','D','Large incumbent / regulated',true,'SE',
 'Full arc: claim, correction, and a service cost line that rose while savings were being reported.'),
('wtw','Willis Towers Watson','WTW','wtw.us','Insurance broking','D','Large incumbent / regulated',true,'GB',
 'The only program found that publishes reinvestment leakage as an explicit line item.'),
('verizon','Verizon Communications','VZ','vz.us','Telecom','D','Large incumbent / regulated',true,'US',
 'Record margin, concurrent cost programs, no separable AI attribution. The normal case.'),
('lumen','Lumen Technologies','LUMN','lumn.us','Telecom','D','Large incumbent / regulated',true,'US',
 'Copilot seller-productivity saving; check whether it lands in opex or is a capacity figure.'),
('amazon','Amazon.com','AMZN','amzn.us','Retail / cloud','D','Large incumbent / regulated',true,'US',
 'Corporate role reductions announced alongside AI-first messaging; causal share undisclosed.'),
('shopify','Shopify','SHOP','shop.us','E-commerce','D','Large incumbent / regulated',true,'CA',
 'Hiring policy change rather than a savings claim. Included because it is a permission-to-act datapoint.'),
('cba','Commonwealth Bank of Australia','CBA','cba.au','Banking','D','Large incumbent / regulated',true,'AU',
 'Claimed call-volume reduction, then reversed AI-attributed role cuts. A Klarna-shaped correction.'),
('duolingo','Duolingo','DUOL','duol.us','Consumer software','D','Large incumbent / regulated',true,'US',
 'AI-first contractor policy and the subsequent public walk-back.'),

-- ---- E: legacy professional services --------------------------------
('accenture','Accenture','ACN','acn.us','Consulting','E','Legacy professional services',true,'IE',
 'Largest known implementer by project count. Growth and margin do not reflect it.'),

-- ---- F: BPO — where other companies AI gains actually land -----------
('teleperformance','Teleperformance SE','TEP','tep.fr','BPO','F','BPO counterparty',true,'FR',
 'Not an SEC filer, so fundamentals are manual. Price series only.'),
('concentrix','Concentrix','CNXC','cnxc.us','BPO','F','BPO counterparty',true,'US',
 'Guidance cut attributed to clients reallocating budget to their own AI.'),

-- ---- J: disrupted — AI destroyed the demand, not the cost -----------
('chegg','Chegg','CHGG','chgg.us','Edtech','J','Disrupted by demand destruction',true,'US',
 'The AI cost program worked exactly as promised and it did not matter.'),
('atlassian','Atlassian','TEAM','team.us','Enterprise software','J','Disrupted by demand destruction',true,'AU',
 'First reported decline in enterprise seat count.'),
('hubspot','HubSpot','HUBS','hubs.us','Enterprise software','J','Disrupted by demand destruction',true,'US',
 'Repriced resolution downward within a year. Pass-through in progress.'),
('intercom','Intercom','',null,'Enterprise software','J','Disrupted by demand destruction',false,'US',
 'Private. Outcome pricing pioneer.'),
('zendesk','Zendesk','',null,'Enterprise software','J','Disrupted by demand destruction',false,'US',
 'Private since 2022. Verified-resolution pricing.'),

-- ---- B: AI-native services roll-ups ---------------------------------
('crescendo','Crescendo AI','',null,'Contact centre','B','AI-native services roll-up',false,'US',
 'Prices per resolved ticket. The pricing change, not the AI, is what produces the margin.'),
('long-lake','Long Lake','',null,'Property management','B','AI-native services roll-up',false,'US',
 'Unaudited EBITDA. Becomes verifiable only if it takes on public reporting obligations.'),
('current-crete','Current (formerly Crete Professionals Alliance)','',null,'Accounting','B','AI-native services roll-up',false,'US',
 'Rebranded June 2026.'),
('dwelly','Dwelly','',null,'Lettings','B','AI-native services roll-up',false,'GB',
 'Cycle-time claim, not a margin claim.'),
('titan-msp','Titan MSP','',null,'Managed IT','B','AI-native services roll-up',false,'US',
 'Task-automation percentage, self-reported.'),

-- ---- A: AI-native greenfield ----------------------------------------
('anysphere','Anysphere (Cursor)','',null,'Dev tools','A','AI-native greenfield',false,'US',
 'Headcount reported as 50, 150 and 300 by credible outlets in one quarter. Any RPE figure spans 6x.'),
('lovable','Lovable','',null,'Dev tools','A','AI-native greenfield',false,'SE',
 'Best-sourced RPE figure in the group.'),
('midjourney','Midjourney','',null,'Generative media','A','AI-native greenfield',false,'US',
 'Headcount reported between 40 and 107.'),

-- ---- G: healthcare delivery -----------------------------------------
('tpmg-kaiser','The Permanente Medical Group','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',
 'Largest ambient-scribe deployment measured.'),
('mass-general-brigham','Mass General Brigham','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',null),
('sutter-health','Sutter Health','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',null),
('uchicago-medicine','UChicago Medicine','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',
 'Matched-control design.'),
('reid-health','Reid Health','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',
 'The exception: converted freed time into billable intensity.'),
('ucla-health','UCLA Health','',null,'Healthcare delivery','G','Healthcare delivery',false,'US',
 'Three-arm randomised controlled trial. Rare design in this space.'),

-- ---- R: research populations. Not firms. Held here so that the
--         disconfirming evidence sits in the same ledger as the claims.
('spi-research-population','SPI professional services benchmark (509 orgs)','',null,'Research','R','Research population',false,'US',null),
('census-btos','US Census Business Trends and Outlook Survey','',null,'Research','R','Research population',false,'US',null),
('denmark-admin-data','Humlum & Vestergaard (Denmark, 25k workers)','',null,'Research','R','Research population',false,'DK',null),
('stanford-canaries','Stanford Digital Economy Lab / ADP','',null,'Research','R','Research population',false,'US',null),
('brynjolfsson-rct','Brynjolfsson, Li & Raymond (5,179 agents)','',null,'Research','R','Research population',false,'US',null),
('mckinsey-state-of-ai','McKinsey State of AI survey','',null,'Research','R','Research population',false,'US',null),
('mit-nanda','MIT Project NANDA','',null,'Research','R','Research population',false,'US',null),
('phti','Peterson Health Technology Institute','',null,'Research','R','Research population',false,'US',null),
('isg','ISG contract-value index','',null,'Research','R','Research population',false,'US',null),
('thomson-reuters','Thomson Reuters legal market survey','',null,'Research','R','Research population',false,'US',null)

on conflict (slug) do update set
  name        = excluded.name,
  ticker      = nullif(excluded.ticker,''),
  stooq_symbol= excluded.stooq_symbol,
  sector      = excluded.sector,
  group_code  = excluded.group_code,
  group_label = excluded.group_label,
  is_public   = excluded.is_public,
  hq_country  = excluded.hq_country,
  notes       = excluded.notes;

-- normalise empty tickers to null so the Worker skips them cleanly
update companies set ticker = null where ticker = '';
