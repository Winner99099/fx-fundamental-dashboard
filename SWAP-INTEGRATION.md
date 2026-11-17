# MacroPulseFX Broker Swap Integration v1

## Files
- Pepperstone MT5 EA: experts/MacroPulseFX_Pepperstone_MT5_Swap.mq5
- IG Markets MT4 EA: experts/MacroPulseFX_IG_MT4_Swap.mq4
- Dashboard importer: swap.js and Swap Intelligence view

Both EAs are read-only. They do not place, modify, or close orders, do not read passwords, and do not send data over the network.

## Daily capture
The default capture time is 08:00 PC local time. Set the computer timezone to Singapore and keep each terminal running at capture time. Change CaptureHourLocal in the EA inputs if required. The EA appends a daily snapshot to a CSV in the terminal's Common\Files folder.

- MT5: MacroPulseFX_Pepperstone_MT5_Swap.csv
- MT4: MacroPulseFX_IG_MT4_Swap.csv

The EA scans the broker's full symbol list and filters to Forex calculation-mode instruments. Review exported symbols for broker suffixes/prefixes and product availability.

## Installation
1. In Pepperstone MT5 choose File > Open Data Folder > MQL5 > Experts. Copy the MT5 .mq5 file into Experts.
2. Open MetaEditor, compile the file, return to MT5 and attach MacroPulseFX_Pepperstone_MT5_Swap to one chart.
3. In IG MT4 choose File > Open Data Folder > MQL4 > Experts. Copy the MT4 .mq4 file into Experts.
4. Compile in MetaEditor and attach MacroPulseFX_IG_MT4_Swap to one chart.
5. Enable Algo Trading / Allow automated trading for each EA. They contain no order functions.
6. Keep the terminal and computer running through the scheduled capture time.

## Import
Open MacroPulseFX > Swap Intelligence > Import broker CSV. Select each broker CSV after the daily capture. The browser stores imported data in local storage; repeat the import after each new capture.

## Interpretation and limitations
The page displays broker raw long/short swap values and their swap mode. It does not pretend raw swap values are SGD cash costs. MT4/MT5 brokers may quote swaps in points, base currency, margin currency, profit currency, interest or other modes. A reliable SGD-per-lot conversion requires mode-aware calculations, contract details, live conversion rates and broker rollover rules. MT4 standard MarketInfo does not provide a universal triple-rollover weekday field; MT4 reports this as unknown.

The static GitHub Pages site cannot receive private terminal files automatically. This first version imports locally in the user's browser and does not publish account-derived data to the public repository. Fully automatic central updates need a private authenticated backend or secure private file-sync service. Never put broker passwords, API keys or account credentials in public source files.
