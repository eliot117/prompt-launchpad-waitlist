// A real-browser regression fixture: it runs the production page helpers and
// form parser, but never calls Supabase, sends email or writes signup records.
import { createServer } from 'node:http';
import { confirmationForm, postedToken, privatePage } from '../lib/waitlist-pages.ts';

const token='a'.repeat(64);
const server=createServer(async(req,res)=>{
  const origin='http://127.0.0.1:3107';
  if(req.method==='GET'&&req.url==='/evidence'){
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify(evidence));return;
  }
  const request=new Request(origin+req.url,{method:req.method,headers:req.headers,
    ...(req.method==='POST'?{body:req,duplex:'half'}:{})});
  let response;
  if(req.method==='POST'){
    const actual=await postedToken(request);
    evidence.push({path:req.url,accepted:actual===token,origin:req.headers.origin??null,referrer:req.headers.referer??null});
    response=privatePage(actual===token?'Confirmed':'Rejected','<p>Fixture only.</p>',actual===token?200:400);
  }else{
    const path=req.url?.startsWith('/unsubscribe')?'/unsubscribe':'/verify';
    response=privatePage('Confirmation fixture',confirmationForm(path,token,'Confirm fixture'));
  }
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
});
const evidence=[];
server.listen(3107,'127.0.0.1',()=>console.log('Read-only browser fixture ready on 127.0.0.1:3107'));
