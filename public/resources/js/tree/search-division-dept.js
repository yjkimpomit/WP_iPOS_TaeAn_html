/**
 * 부서 트리
 * /common/modalPopup.jsp에 연결
 */
$(document).ready(function () {
    // 공통: 검색 디바운스
    var to = null;

    function debounce(fn, wait) {
        clearTimeout(to);
        to = setTimeout(fn, wait);
    }

    var zNodes;

    function initZTree(selector, onClickHandler) {
        var setting = {
            view: {
                showIcon: false,
                nameIsHTML: true,
                selectedMulti: false
            },
            data: {
                key: {name: 'text'},
                simpleData: {
                    enable: true,
                    idKey: 'id',
                    pIdKey: 'parent',
                    rootPId: '#'
                }
            },
            callback: {
                onClick: function (event, treeId, treeNode, clickFlag) {
                    if (typeof onClickHandler === 'function') onClickHandler(treeNode);
                }
            }
        };
        return $.fn.zTree.init($(selector), setting, zNodes);
    }

    // 트리별 클릭 처리
    function handleDeptSelect(writeTo, modalSelector) {
        return function (node) {
            var code = node.id;
            var code_name = String(node.text).replace(/^\[[^\]]+\]/, '').trim();

            $(writeTo.option).val(code);
            $(writeTo.input).val(code_name);

            var treeObj = $.fn.zTree.getZTreeObj($(modalSelector + ' .ztree').attr('id'));
            // 선택해제 및 모두 접기 (개별 트리 기준 처리)
            var tree = $.fn.zTree.getZTreeObj($(writeTo.tree).attr('id'));
            if (tree) {
                tree.cancelSelectedNode();
                tree.expandAll(false);
            }

            // 모달 닫기
            $(modalSelector).find('.close').trigger('click');
        };
    }

    function divisionJSTree() {
        // 각 트리 초기화 및 선택 시 동작 매핑
        var reqTree = initZTree('#reqTree1', handleDeptSelect({option: '#supvDeptOption', input: '#supvDeptInput', tree: '#reqTree1'}, '#searchReqTreePopup'));
        var reqDeptTree = initZTree('#reqDeptTree1', handleDeptSelect({option: '#reqDeptOption', input: '#reqDeptInput', tree: '#reqDeptTree1'}, '#searchReqDeptTreePopup'));
        var opDeptTree = initZTree('#opDeptTree1', handleDeptSelect({option: '#opDeptOption', input: '#opDeptInput', tree: '#opDeptTree1'}, '#searchopDeptTreePopup'));
        var mainDeptTree = initZTree('#mainDeptTree1', handleDeptSelect({option: '#maintDeptOption', input: '#maintDeptInput', tree: '#mainDeptTree1'}, '#searchmainDeptTreePopup'));
        var designDeptTree = initZTree('#designDeptTree1', handleDeptSelect({option: '#designDeptOption', input: '#designDeptInput', tree: '#designDeptTree1'}, '#searchdesignDeptTreePopup'));

        // 요청자 트리: 리프 클릭 시 상세 호출
        var divisionTree2 = initZTree('#divisionTree2', function (node) {
            if (!node.isParent) {
                userDetailList(node.id);
            }
        });
    }

    // dataList
    $.ajax({
        type: "POST"
        , url: "/common/deptList.do"
        , dataType: "json"
        , success: function (data) {
            zNodes = data;
            divisionJSTree();
        }
    });

    // 검색: 입력 2자 이상부터 실행, 각 트리에 대해 퍼지 검색
    function filterZTree(treeSelector, query) {
        var treeObj = $.fn.zTree.getZTreeObj(treeSelector.replace('#', ''));
        if (!treeObj) return;

        // 모든 노드 보이기/닫기 초기화
        treeObj.expandAll(false);
        var allNodes = treeObj.transformToArray(treeObj.getNodes());

        // 일단 모두 숨기기
        allNodes.forEach(function (n) {
            n.highlight = false;
            treeObj.hideNode(n);
        });

        if (!query || query.length < 2) {
            // 초기상태로 복원: 모두 보이기 (루트만 펼침)
            allNodes.forEach(function (n) {
                treeObj.showNode(n);
            });
            return;
        }

        var matched = treeObj.getNodesByParamFuzzy('name', query, null);
        matched.forEach(function (n) {
            n.highlight = true;
            treeObj.showNode(n);

            // 상위 표시 및 펼침
            var p = n.getParentNode();
            while (p) {
                treeObj.showNode(p);
                treeObj.expandNode(p, true, false, false);
                p = p.getParentNode();
            }
            // 하위 표시
            var children = treeObj.transformToArray([n]);
            children.forEach(function (c) {
                treeObj.showNode(c);
            });
        });
    }

    // search keyword
    $('#search-input').on('keyup', function () {
        var q = $(this).val();
        debounce(function () {
            var treeIds = ['#reqTree1', '#reqDeptTree1', '#opDeptTree1', '#divisionTree2', '#mainDeptTree1', '#designDeptTree1'];
            treeIds.forEach(function (sel) {
                filterZTree(sel, q);
            });
        }, 250);
    });
});