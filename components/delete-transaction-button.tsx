import {requireSession} from "@/lib/auth";
import {DeleteTransactionControl} from "@/components/delete-transaction-control";
export async function DeleteTransactionButton({id}:{id:string}){const session=await requireSession();if(session.role!=="ADMINISTRATOR")return null;return <DeleteTransactionControl id={id}/>}
