const form = document.getElementById("form-contato");
const contatos = [];
let linhas = "";

form.addEventListener("submit", function (e) {
  e.preventDefault();

  adicionaLinha();
  atualizaTabela();
});

function adicionaLinha() {
  const inputNomeContato = document.getElementById("nome-contato");
  const inputTelefoneContato = document.getElementById("telefone-contato");

  const contato = {
    nome: inputNomeContato.value,
    telefone: inputTelefoneContato.value,
  };

  contatos.push(contato);

  let linha = "<tr>";
  linha += `<td>${contato.nome}</td>`;
  linha += `<td>${contato.telefone}</td>`;
  linha += `</tr>`;

  linhas += linha;

  inputNomeContato.value = "";
  inputTelefoneContato.value = "";
}

function atualizaTabela() {
  const corpoTabela = document.querySelector("tbody");
  corpoTabela.innerHTML = linhas;
}
