// Pixel diff of two screenshots within a box: node pngdiff.cjs a.png b.png x0 y0 x1 y1 threshold
const fs=require("fs"),zlib=require("zlib");
function png(f){const b=fs.readFileSync(f);let i=8,w,h,ct,idat=[];while(i<b.length){const len=b.readUInt32BE(i),t=b.toString("ascii",i+4,i+8),d=b.slice(i+8,i+8+len);if(t==="IHDR"){w=d.readUInt32BE(0);h=d.readUInt32BE(4);ct=d[9]}if(t==="IDAT")idat.push(d);i+=12+len}
const raw=zlib.inflateSync(Buffer.concat(idat)),bpp=ct===6?4:3,stride=w*bpp,out=Buffer.alloc(w*h*bpp);let p=0;
for(let y=0;y<h;y++){const f=raw[p++];for(let x=0;x<stride;x++){const a=x>=bpp?out[y*stride+x-bpp]:0,up=y?out[(y-1)*stride+x]:0,c=x>=bpp&&y?out[(y-1)*stride+x-bpp]:0;let v=raw[p++];
if(f===1)v+=a;else if(f===2)v+=up;else if(f===3)v+=(a+up)>>1;else if(f===4){const pa=Math.abs(up-c),pb=Math.abs(a-c),pc=Math.abs(a+up-2*c);v+=pa<=pb&&pa<=pc?a:pb<=pc?up:c}out[y*stride+x]=v&255}}return{w,h,out,bpp}}
const [a,b,x0,y0,x1,y1,th]=process.argv.slice(2);const A=png(a),B=png(b);let diff=0,n=0,max=0,sum=0;
for(let y=+y0;y<+y1;y++)for(let x=+x0;x<+x1;x++){const i=(y*A.w+x)*A.bpp;let d=0;for(let c=0;c<3;c++)d=Math.max(d,Math.abs(A.out[i+c]-B.out[i+c]));if(d>+th)diff++;max=Math.max(max,d);sum+=d;n++}
console.log(`${b}: ${(diff/n*100).toFixed(3)}% of pixels differ by >${th}, mean diff ${(sum/n).toFixed(2)}, max ${max}`);
