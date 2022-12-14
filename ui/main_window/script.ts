
class TextMeasure {
	static readonly canvas = document.createElement("canvas");
	static readonly context = this.canvas.getContext("2d")!;

	static width_of(text: string, element: HTMLElement): number {
		TextMeasure.context.font = getComputedStyle(element).getPropertyValue("font");
		return TextMeasure.context.measureText(text).width;
	}
}

//----------------------------------------------------------------

type LearningTask = {
	word_id: number,
	sentence_id: number,
	word: string,
	word_pos: number,
	sentence: string,
	translations: string[],
};

let current_task: LearningTask | null = null;

enum TaskState {
	InputWord,
	Feedback,
}

let task_state = TaskState.InputWord;

//----------------------------------------------------------------

const invoke = (window as any).__TAURI__.invoke;

const word_input = document.getElementById("word-input")! as HTMLInputElement;
const word_input_hint = document.getElementById("word-input-hint")! as HTMLElement;
const next_button = document.getElementById("next-button")! as HTMLButtonElement;

function set_button_text(button: HTMLButtonElement, text: string): void {
	button.firstChild!.textContent = text;
}

function next_task() {
	const pre_input_word_text = document.getElementById("pre-input-word-text") as HTMLParagraphElement;
	const post_input_word_text = document.getElementById("post-input-word-text") as HTMLParagraphElement;
	const translations_list = document.getElementById("translations") as HTMLUListElement;

	invoke("next_task", {}).then((task: LearningTask) => {
		pre_input_word_text.innerText = task.sentence.substring(0, task.word_pos);
		post_input_word_text.innerText = task.sentence.substring(task.word_pos + task.word.length);
	
		const word_width = TextMeasure.width_of(task.word, word_input);
		word_input.style.width = `${word_width}px`;

		word_input.value = "";
		word_input.readOnly = false;
		word_input.style.color = "white";
		word_input_hint.style.display = "none";

		set_button_text(next_button, "Check");
	
		current_task = task;
		task_state = TaskState.InputWord;
		
		translations_list.innerHTML = "";
		for (const sentence of task.translations) {
			const item = document.createElement("li");
			item.innerText = sentence;
			translations_list.appendChild(item);
		}
	});
}

document.fonts.ready.then(next_task);

//----------------------------------------------------------------

enum TaskResult {
	Failed,
	Succeeded,
}

type FinishedTask = {
	word_id: number,
	sentence_id: number,
	result: string,
};

function finish_task(result: TaskResult) {
	if (current_task == null) {
		return;
	}
	
	let finished_task: FinishedTask = {
		word_id: current_task?.word_id,
		sentence_id: current_task?.sentence_id,
		result: result == TaskResult.Failed ? "Failed" : "Succeeded",
	};
	invoke("finish_task", { task: finished_task });
}


//----------------------------------------------------------------

function enter() {
	if (current_task == null) {
		return;
	}
	
	switch (task_state) {
		case TaskState.InputWord:
			if (word_input.value.toLowerCase() == current_task?.word.toLowerCase()) {
				finish_task(TaskResult.Succeeded);
				show_success_feedback();
			}
			else {
				finish_task(TaskResult.Failed);
				retry();
			}
			break;
		case TaskState.Feedback:
			next_task();
			break;
	}

	word_input.focus();
}

next_button.addEventListener("click", enter);
word_input.addEventListener("keyup", e => {
	if (e.key == "Enter") {
		enter();
	}
});
word_input.addEventListener("input", () => {
	word_input_hint.style.display = "none";
});

//----------------------------------------------------------------

function show_success_feedback() {
	word_input.style.color = "var(--green)";
	word_input.readOnly = true;
	set_button_text(next_button, "Next");
	task_state = TaskState.Feedback;
}

function retry() {
	if (current_task == null) {
		return;
	}
	
	let hint = current_task.word;
	let pos = 0;
	for (const letter of word_input.value.substring(0, hint.length)) {
		const pos_in_hint = hint.indexOf(letter, pos);
		if (pos_in_hint >= 0) {
			hint = `${hint.substring(0, pos_in_hint)}<i>${letter}</i>${hint.substring(pos_in_hint + 1)}`;
			pos = pos_in_hint + 1 + "<i></i>".length;
		}
		else {
			++pos;
		}
	}
	word_input_hint.innerHTML = hint;
	word_input_hint.style.display = "block";
	word_input.value = "";
}

//----------------------------------------------------------------

const task_page = document.getElementById("task")!;
const options_page = document.getElementById("options")!;

document.getElementById("options-button")?.addEventListener("click", () => {
	task_page.style.display = "none";
	options_page.style.display = "flex";
});

document.getElementById("back-button")?.addEventListener("click", () => {
	task_page.style.display = "flex";
	options_page.style.display = "none";
});

//----------------------------------------------------------------

const language_dropdown = document.getElementById("language-dropdown")! as HTMLSelectElement;

invoke("get_saved_language_list", {}).then((languages: string[]) => {
	for (const language of languages) {
		const option = document.createElement("option");
		option.value = language;
		option.innerText = language;
		language_dropdown.appendChild(option);
	}
	invoke("get_current_language", {}).then((language: string) => {
		language_dropdown.value = language;
	});
});


document.getElementById("add-language-button")?.addEventListener("click", () => {
	invoke("add_language", {});
});

language_dropdown.addEventListener("change", () => {
	invoke("set_current_language", { languageName: language_dropdown.value }).then(() => {
		next_task();
	});
});

//----------------------------------------------------------------

type WeightFactors = {
	succeeded: number,
	failed: number,
};

const success_weight_factor_input = document.getElementById("success-weight-factor-input")! as HTMLInputElement;
const failure_weight_factor_input = document.getElementById("failure-weight-factor-input")! as HTMLInputElement;

invoke("get_weight_factors", {}).then((weight_factors: WeightFactors) => {
	success_weight_factor_input.value = weight_factors.succeeded.toString();
	failure_weight_factor_input.value = weight_factors.failed.toString();
});

success_weight_factor_input.addEventListener("change", () => {
	invoke("set_success_weight_factor", { factor: success_weight_factor_input.value });
});
failure_weight_factor_input.addEventListener("change", () => {
	invoke("set_failure_weight_factor", { factor: failure_weight_factor_input.value });
});
