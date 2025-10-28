import jwt from "jsonwebtoken";

// const authUser = async (req, res, next)=>{
//     const {token} = req.cookies;

//     const user = jwt.verify(token, process.env.JWT_SECRET);

//     if(!token){
//         return res.json({success:false, message:"Not Authorized"});
//     }

//     try {
//         const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);
//         if(tokenDecode.id){
//             req.body.userId = tokenDecode.id;
//         }else{
//             return res.json({success:false, message:"Not Authorized"})
//         }
//         next();
//     } catch (err) {
//         console.error(user);
//         return res.json({ success:false, message: err.message });
//     }
// }
// export default authUser

const authUser = async (req, res, next) => {
  const { token } = req.cookies;

  try {
    if (!token) {
      return res.json({ success: false, message: "No token provided" });
    }

    const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

    if (tokenDecode.id) {
      req.userId = tokenDecode.id;
      next();
    } else {
      return res.json({ success: false, message: "Not Authorized"  });
    }

  } catch (err) {
    console.error(err);
    return res.json({ success: false, message: err.message });
  }
};

export default authUser;
