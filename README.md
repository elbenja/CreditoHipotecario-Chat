# CréditoHipotecar.io Chat

CréditoHipotecar.io Chat is a Spanish-language prototype for people in Peru evaluating an apartment purchase. Buyers can describe a property or paste a listing link. As they chat, the app extracts details like the price, down payment, and interest rate into a panel where buyers can review and edit them before estimating monthly payments or comparing loan scenarios.

## Example

Camila, a fictional buyer, writes, “Estoy viendo un depa en Jesús María de S/ 380,000. Tengo S/ 76,000 de inicial y el banco me ofrece una TEA de 8.5%. ¿Cuánto pagaría al mes?” The chat pins those details and can ask how many years she plans to borrow for. Once she has an estimate, she can edit the down payment and recalculate.

## Where the numbers come from

The panel gives estimates and buyer-provided figures distinct labels. The API checks the buyer’s messages before marking an extracted figure as buyer-provided. [See how the API checks the source](apps/api/src/pipeline/provenance.ts).

[View the public design walkthrough](https://credito-hipotecario-chat.vercel.app/disenos/datos-fijados/)
