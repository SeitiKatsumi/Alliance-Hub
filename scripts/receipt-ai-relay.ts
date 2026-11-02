import {receiptRelay,openAIReceiptReader} from '../server/receipt-ai-relay';
const key=process.env.OPENAI_API_KEY,token=process.env.RECEIPT_RELAY_TOKEN;
if(!key||!token)throw new Error('Missing relay configuration');
receiptRelay(token,openAIReceiptReader(key)).listen(3025,'0.0.0.0');
