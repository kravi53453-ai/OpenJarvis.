import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const webDir=path.resolve(__dirname,'../../web');
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin:true}));
app.use(express.json({limit:'8mb'}));
app.use(express.static(webDir));
const port=Number(process.env.PORT||3000);
const keys={gemini:process.env.GEMINI_API_KEY,openai:process.env.OPENAI_API_KEY,anthropic:process.env.ANTHROPIC_API_KEY,deepseek:process.env.DEEPSEEK_API_KEY};
let activeProvider=(process.env.AI_PROVIDER||'gemini').toLowerCase();
let runtimeKey=null;
const keyFor=p=>runtimeKey?.provider===p?runtimeKey.key:keys[p];
app.get('/api/health',(req,res)=>res.json({ok:true,service:'OpenJarvis API',provider:activeProvider,configured:Boolean(keyFor(activeProvider))}));
app.post('/api/settings/provider',(req,res)=>{const {provider,apiKey}=req.body||{};if(!['gemini','openai','anthropic','deepseek'].includes(provider)||typeof apiKey!=='string'||apiKey.length<8)return res.status(400).json({error:'Invalid provider or API key'});runtimeKey={provider,key:apiKey};activeProvider=provider;res.json({ok:true,provider,configured:true})});
async function askGemini(key,prompt){const url=`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'Gemini request failed');return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'No text response.'}
async function askOpenAI(key,prompt,model='gpt-4o-mini',baseURL){const client=new OpenAI({apiKey:key,baseURL});const r=await client.chat.completions.create({model,messages:[{role:'system',content:'You are OpenJarvis. Be helpful, safe, and concise. The selected persona is reflected in the user prompt.'},{role:'user',content:prompt}]});return r.choices?.[0]?.message?.content||'No text response.'}
app.post('/api/chat',async(req,res)=>{try{const {message,character='Adam'}=req.body||{};if(typeof message!=='string'||!message.trim())return res.status(400).json({error:'Message is required'});const provider=activeProvider,key=keyFor(provider);if(!key)return res.status(503).json({error:`No API key configured for ${provider}`});const persona=character==='Kajal'?'You are Kajal, a warm, respectful female assistant.':'You are Adam, a confident, respectful male assistant.';const prompt=`${persona}\nUser message: ${message}`;let reply;if(provider==='gemini')reply=await askGemini(key,prompt);else if(provider==='openai')reply=await askOpenAI(key,prompt);else if(provider==='deepseek')reply=await askOpenAI(key,prompt,'deepseek-chat','https://api.deepseek.com');else{const client=new Anthropic({apiKey:key});const r=await client.messages.create({model:'claude-3-5-haiku-latest',max_tokens:1200,messages:[{role:'user',content:prompt}]});reply=r.content?.map(x=>x.text||'').join('')||'No text response.'}res.json({reply,provider,character})}catch(e){console.error('chat error:',e.message);res.status(502).json({error:'AI provider request failed',detail:process.env.NODE_ENV==='development'?e.message:undefined})}});
app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`OpenJarvis backend listening on ${process.env.HOST||'127.0.0.1'}:${port}`));
