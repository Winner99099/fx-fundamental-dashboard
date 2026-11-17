#property strict
#property version "1.00"
#property description "MacroPulseFX daily read-only swap exporter for Pepperstone MT5"
input int CaptureHourLocal=8;
input bool ForexSymbolsOnly=true;
input string OutputFile="MacroPulseFX_Pepperstone_MT5_Swap.csv";
string GV_LAST_RUN="MacroPulseFX_MT5_LastRun";
int OnInit(){EventSetTimer(30);Print("MacroPulseFX MT5 exporter ready. Set PC timezone to Singapore.");return INIT_SUCCEEDED;}
void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){
 MqlDateTime dt;TimeToStruct(TimeLocal(),dt);if(dt.hour<CaptureHourLocal)return;
 int stamp=dt.year*10000+dt.mon*100+dt.day;
 if(GlobalVariableCheck(GV_LAST_RUN)&&(int)GlobalVariableGet(GV_LAST_RUN)==stamp)return;
 if(ExportSnapshot())GlobalVariableSet(GV_LAST_RUN,stamp);
}
bool IsForexSymbol(string sym){long mode=0;if(!SymbolInfoInteger(sym,SYMBOL_TRADE_CALC_MODE,mode))return false;return(mode==SYMBOL_CALC_MODE_FOREX||mode==SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE);}
bool ExportSnapshot(){
 int h=FileOpen(OutputFile,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE,',');
 if(h==INVALID_HANDLE){Print("MacroPulseFX file open error ",GetLastError());return false;}
 if(FileSize(h)==0)FileWrite(h,"captured_local","broker","platform","account_currency","symbol","swap_long","swap_short","swap_mode","contract_size","tick_value","tick_size","profit_currency","margin_currency","rollover_3x_day","calculation_mode");
 FileSeek(h,0,SEEK_END);string captured=TimeToString(TimeLocal(),TIME_DATE|TIME_SECONDS);int total=SymbolsTotal(false),written=0;
 for(int i=0;i<total;i++){
  string sym=SymbolName(i,false);if(sym=="")continue;if(ForexSymbolsOnly&&!IsForexSymbol(sym))continue;if(!SymbolSelect(sym,true))continue;
  double sl=0,ss=0,cs=0,tv=0,ts=0;long sm=0,rd=0,cm=0;
  if(!SymbolInfoDouble(sym,SYMBOL_SWAP_LONG,sl)||!SymbolInfoDouble(sym,SYMBOL_SWAP_SHORT,ss))continue;
  SymbolInfoDouble(sym,SYMBOL_TRADE_CONTRACT_SIZE,cs);SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_VALUE,tv);SymbolInfoDouble(sym,SYMBOL_TRADE_TICK_SIZE,ts);
  SymbolInfoInteger(sym,SYMBOL_SWAP_MODE,sm);SymbolInfoInteger(sym,SYMBOL_SWAP_ROLLOVER3DAYS,rd);SymbolInfoInteger(sym,SYMBOL_TRADE_CALC_MODE,cm);
  FileWrite(h,captured,AccountInfoString(ACCOUNT_COMPANY),"MT5",AccountInfoString(ACCOUNT_CURRENCY),sym,DoubleToString(sl,8),DoubleToString(ss,8),IntegerToString((int)sm),DoubleToString(cs,2),DoubleToString(tv,8),DoubleToString(ts,8),SymbolInfoString(sym,SYMBOL_CURRENCY_PROFIT),SymbolInfoString(sym,SYMBOL_CURRENCY_MARGIN),IntegerToString((int)rd),IntegerToString((int)cm));written++;
 }
 FileFlush(h);FileClose(h);Print("MacroPulseFX MT5 exported ",written," Forex symbols to Common Files/",OutputFile);return(written>0);
}