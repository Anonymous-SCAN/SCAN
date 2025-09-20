# SCAN

This is the official code of SCAN.

##  ⬇️ Preparation

### Environment Installation

```bash
conda create -n SCAN python=3.12
conda activate SCAN
 
pip install -r requirements.txt
```


## 🌲 1 Taxonomy Preparation

You can choose to use the taxonomy we provide. See: [visualization_and_analysis/cata_tree.json](visualization_and_analysis/cata_tree.json).

(Optional) You can also choose to customize your own taxonomy since SCAN is highly extensible. Guidelines for building your customized taxonomy tree can be found in: [Build Customized Taxonomy Tree](taxonomy).

## 🎁 2 Dataset Preparation

You can choose to use the evaluation dataset we provide. See: [evaluation/outputs/evaluation_dataset.jsonl](evaluation/outputs/evaluation_dataset.jsonl). 

If you want to use the criteria and baseline model we provide, you can directly use the criteria we generated.  

(Optional) You can also create your own custom evaluation dataset using our RealMix. Guidelines for building your customized evaluation dataset can be found in: [Generate New Queries](query_synthesis).

## 🎯 3 Evaluation

If you simply want to test our Visualization and Analysis Toolkits, you can directly use the generation and evaluation results we provided in [evaluation/outputs](evaluation/outputs).

### 🧩 3.1 Model Service Preparation

When you reach this step, we first recommend preparing several models:

1. **Model to be evaluated**: The model you want to evaluate.
2. **(Optional) Model for pre-comparison**: Our evaluation method requires several models to generate their responses to assist in extracting more effective evaluation criteria. This can be any model. We adopt gpt-4o, deepseek-v3, and doubao-1-5-pro in our paper. (If you're using the criteria we generated, you do not need to prepare this model.) 
3. **(Optional) Baseline model**: The model that serves as the baseline in the evaluation. Our evaluation results are relative to its performance. We adopt gpt-4o in our paper. (If you're using the baseline model we use, you do not need to prepare this model.)
4. **Evaluation model**: This model is used to generate criteria and evaluate other models. We recommend using more advanced models, especially reasoning models. We adopt DeepSeek-R1 in our paper.  

Note that you need to prepare your models in OpenAI-compatible format. Evaluation requires three things: model name, base url, and API key. 

### 🚀 3.2 Execute the Evaluation

After you have prepared these services, you can follow the guidance in [Evaluate Models](evaluation) to perform the evaluation. 

## 📊 4 Visualization and Analysis Toolkits

1. Place the evaluation results obtained from the previous step into the `visualization_and_analysis/evaluation_source_data` directory.
2. Enter the directory: `cd ./visualization_and_analysis`
3. Run the following command to process the data obtained above.
```bash
python source_result_processing.py
```
4. Run the following command to get the analysis results.
```bash
python auto_analysing.py
```
5. Then, you can run the visualization and analysis tools locally.
```bash
python -m http.server 8103
```

For more details, refer to: [Visualization and Analysis](visualization_and_analysis).
 

