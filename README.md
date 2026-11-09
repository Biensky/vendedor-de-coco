# Vendedor de Cocó 

Crie o app "Cocó do Parque": um PWA mobile-first (100% em português do Brasil, moeda R$) de fidelidade e controle de vendas para vendedores ambulantes de água de coco. Ele deve ser MULTI-VENDEDOR (SaaS): cada vendedor cria a própria conta (e-mail/senha) e só enxerga os próprios dados (use Lovable Cloud com autenticação e políticas RLS por vendedor). Visual: verde-coco e branco, botões grandes, fácil de usar com uma mão debaixo de sol; instalável na tela inicial (manifest + ícone).

FUNCIONALIDADES DO VENDEDOR (área logada):

1. Produtos (editáveis): nome, preço de venda e custo unitário. Criar automaticamente na primeira entrada estes padrões: Coco (custo R$ 2,00 / venda R$ 8,00), Garrafa 500ml (custo em branco para o vendedor preencher / venda R$ 10,00), Garrafa 1L (custo em branco / venda R$ 18,00). Permitir adicionar, editar e desativar produtos.

2. Clientes: cadastro com nome, WhatsApp e observação. Cada cliente recebe um código único e um QR Code pessoal. Botão "Enviar cartão por WhatsApp" que abre wa.me com mensagem e o link público do cartão do cliente.

3. Programa de fidelidade configurável: regra padrão "a cada 10 cocos pagos, ganhe 1 coco grátis" (o vendedor escolhe o produto, a quantidade necessária e o brinde). Cada compra do produto adiciona selos; ao completar, gera automaticamente um crédito de brinde na carteira do cliente.

4. Combos configuráveis: nome, itens comprados + quantidades, brinde + quantidade, preço do combo (padrão = soma dos itens). Exemplo pré-cadastrado: "3 garrafas de 1L + 1 garrafa de 500ml grátis" a R$ 54,00.

5. Carteira de créditos / retirada parcelada: quando o cliente compra um combo ou produtos e não leva tudo na hora, os itens pagos e os brindes ficam como CRÉDITOS a retirar na carteira dele. Em cada visita o vendedor escaneia o QR e dá baixa de 1 ou mais unidades ("Entregar"). Guardar histórico de cada entrega com data/hora.

6. Tela principal = "Escanear QR" (câmera do celular, ex.: html5-qrcode) com busca manual por nome/telefone como alternativa. Ao identificar o cliente, mostrar: nome, cartão de selos (ex.: 7/10), créditos pendentes por produto, e botões grandes: "Registrar venda" (escolhe produtos/quantidades ou combo, forma de pagamento Dinheiro/Pix/Cartão, e marca se o cliente leva agora ou deixa como crédito), "Entregar crédito" e "Histórico".

7. Venda avulsa rápida sem cliente identificado (só para o caixa, sem selos).

8. Painel financeiro: hoje / semana / mês — quantidade vendida por produto, receita, custo, lucro bruto, custo dos brindes entregues, clientes atendidos, clientes que voltaram (recorrência) e créditos pendentes de retirada. Inclua um card "Simulação" mostrando, com base nos preços e custos cadastrados, o lucro diário e mensal (26 dias) para uma meta de cocos/dia editável (padrão 10).

ÁREA PÚBLICA DO CLIENTE (sem login): página /c/{codigo} mostrando o QR Code, nome do vendedor, selos acumulados, créditos a retirar e histórico resumido — o cliente mostra essa tela ao vendedor.

ESTRUTURA PARA COBRANÇA (sem integrar pagamento agora): cada vendedor tem um campo de plano (Teste grátis 30 dias / Ativo / Suspenso) com data de vencimento, e uma página simples de super-admin (para o dono da plataforma, definido por um papel "admin" em tabela separada de papéis) listando vendedores, plano, vencimento, quantidade de clientes e vendas do mês, com opção de ativar/suspender. Vendedor suspenso vê aviso para regularizar via WhatsApp (61) 98140-2233.

Landing page simples na raiz explicando o app para vendedores ambulantes (coco, açaí, caldo de cana, pastel, food truck) com botão "Criar minha conta" e "Entrar".

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vendedor-de-coco.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8617e047-1338-4b8a-985b-f328d184ee55).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
