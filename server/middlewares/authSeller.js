import jwt from "jsonwebtoken";

const authSeller = async (req,res,next)=>{
    const {sellerToken} = req.cookies;
    if(!sellerToken){
        return res.json({success: false, message: 'Not Authorized'})
    }
    try {
        if (!sellerToken) {
          return res.json({ success: false, message: "No token provided" });
        }
    
        const tokenDecode = jwt.verify(sellerToken, process.env.JWT_SECRET);
    
        if (tokenDecode.email === process.env.SELLER_EMAIL) {
          next();
        } else {
          return res.json({ success: false, message: "Not Authorized"  });
        }
    
      } catch (err) {
        console.error(err);
        return res.json({ success: false, message: err.message });
      }
}

export default authSeller;