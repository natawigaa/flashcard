import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const files = [
  { in: path.resolve('docs/architecture.svg'), out: path.resolve('docs/architecture.png') },
  { in: path.resolve('docs/connectivity.svg'), out: path.resolve('docs/connectivity.png') }
]

async function run(){
  for(const f of files){
    if(!fs.existsSync(f.in)){
      console.error('Missing input file', f.in)
      continue
    }
    const svg = fs.readFileSync(f.in)
    try{
      await sharp(svg)
        .png({ compressionLevel:9 })
        .toFile(f.out)
      console.log('Wrote', f.out)
    }catch(err){
      console.error('Failed to convert', f.in, err)
    }
  }
}

run()

