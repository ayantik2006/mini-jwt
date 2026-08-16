import crypto from "node:crypto";

function base64urlEncode(data) {
  return Buffer.from(data).toString("base64url");
}

function base64urlDecode(data) {
  return Buffer.from(data, "base64url").toString("utf8");
}

function hmacSHA256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
}

export function sign(payload, expiresIn, JWT_SECRET) {
  const timeLetter=expiresIn[expiresIn.length-1];
  const timeLetterValues={
    s:1*1000,
    m:60*1000,
    h:60*60*1000,
    d:60*60*24*1000,
    w:60*60*24*7*1000,
    M:60*60*24*7*30*1000,
    y:60*60*24*7*30*12*1000
  }
  expiresIn=timeLetterValues[timeLetter]*Number(expiresIn.slice(0,expiresIn.length-1));

  payload={
    ...payload,
    expiresAt:new Date().getTime()+expiresIn
  }
  
  payload = JSON.stringify(payload);

  let header = JSON.stringify({
    type: "miniJwt",
    algo: "HS250",
  });

  payload = base64urlEncode(payload);
  header = base64urlEncode(header);

  let headerPayload = header + "." + payload;

  const signature = hmacSHA256(headerPayload, JWT_SECRET);

  const token = headerPayload+"."+signature;

  return token;
}

export function verify(token, JWT_SECRET) {
    const tokenParts=token.split(".");
    if(tokenParts.length!=3){
        throw new Error("Invalid token");
    }

    let header=token.split(".")[0];
    let payload=token.split(".")[1];
    let signature=token.split(".")[2];

    let headerPayload = header + "." + payload;

    header=JSON.parse(base64urlDecode(header));
    if(header.algo!=="HS250"){
        throw new Error("Invalid algorithm");
    }

    let newSignature=hmacSHA256(headerPayload, JWT_SECRET);

    if(signature!==newSignature){
        throw new Error("Invalid token");
    }
    
    payload=base64urlDecode(payload);
    
    payload=JSON.parse(payload);

    let expiresAt=payload.expiresAt;
    
    if(new Date().getTime()>=expiresAt){
        throw new Error("Token Expired");
    }    

    return payload;
}