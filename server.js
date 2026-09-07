import express from "express";
import cors from "cors";
import express from "express";
import cors from "cors";
import axios from "axios";


const app = express();


app.use(cors());
app.use(express.json());



const API_KEY="sk-ws-H.PDDMMEX.nqpn.MEUCIGw354poXtMeXWbIPCKglCX0yOBC8lDGdRyfx6eBXT1TAiEA05i-2C2xJVRdCWXek9i-c3siD-b_C4UeOBdG3fbGDlM"



app.post("/tts", async(req,res)=>{

    try{

        const text=req.body.text;


        const response = await axios.post(

            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-speech/generation",


            {
                model:"cosyvoice-v1",

                input:{
                    text:text
                }
            },


            {
                headers:{
                    Authorization:
                    "Bearer "+API_KEY,

                    "Content-Type":
                    "application/json"
                }
            }

        );


        console.log(response.data);


        res.json(response.data);


    }catch(error){

        console.log("百炼错误:");

        console.log(error.response?.data);


        res.status(500).json({
            error:"TTS失败",
            detail:error.response?.data
        });

    }

});



app.listen(3000,()=>{

console.log("小山TTS启动成功");

});