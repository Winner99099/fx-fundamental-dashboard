#property strict
#property version "1.00"
#property description "MacroPulseFX daily read-only swap exporter for IG Markets MT4"
input int CaptureHourLocal=8;
input bool ForexSymbolsOnly=true;
input string OutputFile="MacroPulseFX_IG_MT4_Swap.csv";
string GV_LAST_RUN="MacroPulseFX_MT4_LastRun";
int OnInit(){EventSetTimer(30);Print("MacroPulseFX MT4 exporter ready. Set PC timezone to Singapore.");return(INIT_SUCCEEDED);}
void OnDeinit(const int reason){EventKillTimer();}
void OnTimer(){
 datetime now=TimeLocal();if(TimeHour(now)<CaptureHourLocal)return;
 int stamp=TimeYear(now)*10000+TimeMonth(now)*100+TimeDay(now);
 if(GlobalVariableCheck(GV_LAST_RUN)&&(int)GlobalVariableGet(GV_LAST_RUN)==stamp)return;
 if(ExportSnapshot())GlobalVariableSet(GV_LAST_RUN,stamp);
}
bool IsForexSymbol(string sym){return((int)MarketInfo(sym,MODE_PROFITCALCMODE)==0);}
bool ExportSnapshot(){
 int h=FileOpen(OutputFile,FILE_READ|FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON|FILE_SHARE_READ|FILE_SHARE_WRITE,',');
 if(h==INVALID_HANDLE){Print("MacroPulseFX file open error ",GetLastError());return false;}
 if(FileSize(h)==0)FileWrite(h,"captured_local","broker","platform","account_currency","symbol","swap_long","swap_short","swap_mode","contract_size","tick_value","tick_size","profit_currency","margin_currency","rollover_3x_day","calculation_mode");
 FileSeek(h,0,SEEK_END);string captured=TimeToString(TimeLocal(),TIME_DATE|TIME_SECONDS);int total=SymbolsTotal(false),written=0;
 for(int i=0;i<total;i++){
  string sym=SymbolName(i,false);if(sym=="")continue;if(ForexSymbolsOnly&&!IsForexSymbol(sym))continue;
  double sl=MarketInfo(sym,MODE_SWAPLONG),ss=MarketInfo(sym,MODE_SWAPSHORT),lots=MarketInfo(sym,MODE_LOTSIZE),tv=MarketInfo(sym,MODE_TICKVALUE),ts=MarketInfo(sym,MODE_TICKSIZE);int sm=(int)MarketInfo(sym,MODE_SWAPTYPE);
  FileWrite(h,captured,AccountCompany(),"MT4",AccountCurrency(),sym,DoubleToString(sl,8),DoubleToString(ss,8),IntegerToString(sm),DoubleToString(lots,2),DoubleToString(tv,8),DoubleToString(ts,8),"","","unknown",IntegerToString((int)MarketInfo(sym,MODE_PROFITCALCMODE)));written++;
 }
 FileFlush(h);FileClose(h);Print("MacroPulseFX MT4 exported ",written," Forex symbols to Common Files/",OutputFile);return(written>0);
}