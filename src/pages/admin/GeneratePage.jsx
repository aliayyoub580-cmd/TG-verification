import React, { useEffect, useState } from 'react';
import { qrAPI, productsAPI } from '../../services/api.js';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Pagination from '../../components/Pagination.jsx';
import { fmt, fmtDate } from '../../utils/download.js';
import toast from 'react-hot-toast';

export default function GeneratePage(){
  const [rows,setRows]=useState([]),[products,setProducts]=useState([]),[selected,setSelected]=useState(new Set());
  const [filters,setFilters]=useState({search:'',product_id:'',date_from:'',date_to:'',page:1,limit:25});
  const [total,setTotal]=useState(0),[loading,setLoading]=useState(false),[generating,setGenerating]=useState(false);
  const load=async()=>{setLoading(true);try{const {data}=await qrAPI.pending(filters);setRows(data.data||[]);setTotal(data.pagination?.total||0);setSelected(new Set());}catch(e){toast.error(e.response?.data?.message||'Could not load pending codes');}finally{setLoading(false)}};
  useEffect(()=>{productsAPI.list({limit:200}).then(({data})=>setProducts(data.data||[]));},[]);
  useEffect(()=>{load();},[filters.page,filters.product_id,filters.date_from,filters.date_to]);
  const run=async(ids)=>{if(!ids.length||generating)return;setGenerating(true);const tid=toast.loading(`Generating ${ids.length} QR image(s)…`);try{const {data}=await qrAPI.generate(ids);const result=data.data;if(!data.success||result.failed){const detail=result.errors?.[0]?.message||data.message||'QR generation failed';if(result.generated>0)toast.error(`Generated ${fmt(result.generated)}; ${fmt(result.failed)} failed. ${detail}`,{id:tid,duration:7000});else toast.error(detail,{id:tid,duration:7000});}else if(result.alreadyGenerated&&!result.generated)toast(`QR image already exists`,{id:tid});else toast.success(`Generated ${fmt(result.generated)} QR image(s)`,{id:tid});await load();}catch(e){const detail=e.response?.data?.message||e.response?.data?.data?.errors?.[0]?.message||'QR generation failed';toast.error(detail,{id:tid,duration:7000});}finally{setGenerating(false)}};
  const selectAllFiltered=async()=>{try{const{data}=await qrAPI.pending({...filters,all:'true'});setSelected(new Set((data.data||[]).map(r=>r.id)));toast.success(`${fmt(data.data?.length)} filtered code(s) selected`)}catch{toast.error('Could not select filtered codes')}};
  const toggle=id=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n});
  const pageIds=rows.map(r=>r.id),all=pageIds.length>0&&pageIds.every(id=>selected.has(id));
  return <div><div className="page-header"><div><h1 className="page-title">Generate QR Codes</h1><p className="page-subtitle">Generate PNG images for imported client codes</p></div><div style={{display:'flex',gap:8}}><Button variant="outline" disabled={!total||generating} onClick={selectAllFiltered}>Select All Filtered</Button><Button disabled={!selected.size||generating} loading={generating} onClick={()=>run([...selected])}>Generate Selected ({selected.size})</Button></div></div>
    <div className="card"><div className="card-body"><div className="filter-bar">
      <input className="form-control" placeholder="Search code…" value={filters.search} onChange={e=>setFilters({...filters,search:e.target.value})} onKeyDown={e=>e.key==='Enter'&&load()}/>
      <select className="form-control form-select" value={filters.product_id} onChange={e=>setFilters({...filters,product_id:e.target.value,page:1})}><option value="">All products</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input type="date" className="form-control" value={filters.date_from} onChange={e=>setFilters({...filters,date_from:e.target.value,page:1})}/><input type="date" className="form-control" value={filters.date_to} onChange={e=>setFilters({...filters,date_to:e.target.value,page:1})}/><Button variant="outline" onClick={()=>{setFilters({...filters,page:1});load();}}>Search</Button>
    </div></div><div className="table-wrap"><table><thead><tr><th><input type="checkbox" checked={all} onChange={()=>setSelected(all?new Set():new Set(pageIds))}/></th><th>Code</th><th>Product</th><th>Imported Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggle(r.id)}/></td><td className="td-code">{r.code}</td><td>{r.products?.name||'—'}</td><td>{fmtDate(r.imported_at)}</td><td><Badge label={r.status} type={r.status}/></td><td><Button size="sm" disabled={generating} onClick={()=>run([r.id])}>Generate</Button></td></tr>)}{!loading&&!rows.length&&<tr><td colSpan="6" style={{textAlign:'center',padding:32}}>No imported codes are waiting for QR generation.</td></tr>}</tbody></table></div>
    <Pagination page={filters.page} totalPages={Math.ceil(total/filters.limit)} onPage={page=>setFilters({...filters,page})}/></div></div>;
}
