const qrCodeService = require('../services/qrCodeService');
const { listPendingCodes, generateForIds } = require('../services/generateService');
const { exportQRCodes, previewCSVImport, importCSV, getCSVTemplate, listImportHistory } = require('../services/importExportService');
const { streamQRZip } = require('../services/zipService');
const { supabaseAdmin } = require('../config/supabase');
const { QR_CODES_BUCKET } = require('../config/constants');
const { paginatedResponse } = require('../utils/pagination');

async function list(req,res,next){try{const r=await qrCodeService.listQRCodes(req.query);res.json(paginatedResponse(r.data,r.total,r.page,r.limit));}catch(e){next(e)}}
async function pending(req,res,next){try{const r=await listPendingCodes(req.query);res.json(paginatedResponse(r.data,r.total,r.page,r.limit));}catch(e){next(e)}}
async function generate(req,res,next){try{const r=await generateForIds(req.body.ids);if(r.generated===0&&r.alreadyGenerated===0&&r.failed>0)return res.status(422).json({success:false,message:r.errors[0].message,data:r});const partial=r.failed>0;res.status(partial?207:200).json({success:!partial,message:partial?`${r.generated} generated; ${r.failed} failed`:undefined,data:r});}catch(e){next(e)}}
async function getOne(req,res,next){try{res.json({success:true,data:await qrCodeService.getQRCodeById(req.params.id)});}catch(e){next(e)}}
async function update(req,res,next){try{res.json({success:true,data:await qrCodeService.updateQRCode(req.params.id,req.body)});}catch(e){next(e)}}
async function remove(req,res,next){try{await qrCodeService.deleteQRCode(req.params.id);res.json({success:true});}catch(e){next(e)}}
async function bulkStatus(req,res,next){try{res.json({success:true,...await qrCodeService.bulkUpdateStatus(req.body.ids,req.body.status)});}catch(e){next(e)}}
async function bulkDelete(req,res,next){try{res.json({success:true,...await qrCodeService.bulkDelete(req.body.ids)});}catch(e){next(e)}}
async function previewImport(req,res,next){try{if(!req.file)return res.status(400).json({success:false,message:'No CSV file uploaded'});res.json({success:true,data:await previewCSVImport(req.file.buffer,req.body.productId)});}catch(e){next(e)}}
async function importCodes(req,res,next){try{if(!req.file)return res.status(400).json({success:false,message:'No CSV file uploaded'});res.json({success:true,data:await importCSV(req.file.buffer,{productId:req.body.productId,fileName:req.file.originalname,adminId:req.admin.id})});}catch(e){next(e)}}
async function importHistory(req,res,next){try{res.json({success:true,data:await listImportHistory()});}catch(e){next(e)}}
async function exportCodes(req,res,next){try{const csv=await exportQRCodes(req.query);res.type('text/csv').attachment(`imported-codes-${Date.now()}.csv`).send(csv);}catch(e){next(e)}}
function downloadTemplate(req,res){res.type('text/csv').attachment('verification-codes-template.csv').send(getCSVTemplate());}
async function downloadZip(req,res,next){try{await streamQRZip(res,{ids:req.body.ids,filters:req.body.filters||{}});}catch(e){if(!res.headersSent)next(e)}}
async function downloadPNG(req,res,next){try{const row=await qrCodeService.getQRCodeById(req.params.id);if(!row.qr_generated||!row.qr_image_path)throw Object.assign(new Error('QR image has not been generated'),{statusCode:404});const {data,error}=await supabaseAdmin.storage.from(QR_CODES_BUCKET).download(row.qr_image_path);if(error||!data)throw Object.assign(new Error('QR image is unavailable'),{statusCode:404});res.type('png').attachment(`${row.code.replace(/[^a-zA-Z0-9._-]/g,'_')}.png`).send(Buffer.from(await data.arrayBuffer()));}catch(e){next(e)}}

module.exports={list,pending,generate,getOne,update,remove,bulkStatus,bulkDelete,previewImport,importCodes,importHistory,exportCodes,downloadTemplate,downloadZip,downloadPNG};
